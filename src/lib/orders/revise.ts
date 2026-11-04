import "server-only";
import { aliasKey } from "@/lib/capture/match";
import { extractLine } from "@/lib/capture/text";
import { loadCatalogue } from "@/lib/catalogue";
import { db } from "@/lib/db";
import { buildOrder } from "./build";
import { checkCredit } from "./credit";

export type ReviseResult =
  | { ok: true; learned: boolean; status: "PLACED" | "ON_HOLD" }
  | { ok: false; reason: "not_found" | "not_allowed" | "same" | "bad_sku" | "stock" };

class StockRace extends Error {}

/**
 * Desk correction: swap the product on one line of an order that is still
 * being checked (PLACED or ON_HOLD). The whole order is priced again, because
 * the new product can have a different price, scheme or GST rate. Stock held
 * for the old product goes back and the new product's is reserved, and the
 * credit check is run again against the new total.
 *
 * If the line came from a shopkeeper's message, the correction is remembered
 * for that shop so the next message with the same words picks the right product.
 */
export async function changeLineProduct(input: {
  orderId: string;
  lineId: string;
  newSkuId: string;
  byName: string;
}): Promise<ReviseResult> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { lines: { include: { sku: true } }, retailer: true },
  });
  if (!order) return { ok: false, reason: "not_found" };
  if (order.status !== "PLACED" && order.status !== "ON_HOLD") return { ok: false, reason: "not_allowed" };

  const line = order.lines.find((l) => l.id === input.lineId);
  if (!line) return { ok: false, reason: "not_found" };
  if (line.skuId === input.newSkuId) return { ok: false, reason: "same" };

  // Price against a catalogue where this order's own reserved stock counts as available.
  const catalogue = await loadCatalogue(order.retailerId);
  const reserved = new Map(order.lines.map((l) => [l.skuId, l.qtyCases + l.freeCases]));
  const available = catalogue.map((c) => ({ ...c, stockCases: c.stockCases + (reserved.get(c.id) ?? 0) }));
  if (!available.some((c) => c.id === input.newSkuId)) return { ok: false, reason: "bad_sku" };

  const built = buildOrder(
    available,
    order.lines.map((l) => ({ skuId: l.id === line.id ? input.newSkuId : l.skuId, qtyCases: l.qtyCases })),
  );
  if (!built.ok) return { ok: false, reason: built.reason === "stock" ? "stock" : "bad_sku" };

  // Credit again, without counting this order twice.
  const open = await db.order.aggregate({
    where: { retailerId: order.retailerId, status: { in: ["PLACED", "CONFIRMED"] }, id: { not: order.id } },
    _sum: { totalPaise: true },
  });
  const used = order.retailer.outstandingPaise + (open._sum.totalPaise ?? 0);
  const credit = checkCredit(order.retailer.creditLimitPaise, used, built.priced.totalPaise);
  // An order already on hold stays on hold until the desk releases it.
  const status: "PLACED" | "ON_HOLD" = order.status === "ON_HOLD" || credit.hold ? "ON_HOLD" : "PLACED";

  // What each remaining line remembers about where it came from.
  const meta = new Map(order.lines.map((l) => [l.id === line.id ? input.newSkuId : l.skuId, l]));
  const newSku = built.lines.find((l) => l.skuId === input.newSkuId)!.item;

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status,
          holdReason: status === "ON_HOLD" ? (order.holdReason ?? credit.reason) : null,
          subtotalPaise: built.priced.subtotalPaise,
          discountPaise: built.priced.discountPaise,
          gstPaise: built.priced.gstPaise,
          totalPaise: built.priced.totalPaise,
        },
      });
      if (claimed.count !== 1) throw new StockRace("order changed");

      for (const l of order.lines) {
        await tx.sku.update({
          where: { id: l.skuId },
          data: { stockCases: { increment: l.qtyCases + l.freeCases } },
        });
      }
      for (const l of built.lines) {
        const need = l.qtyCases + l.freeCases;
        const res = await tx.sku.updateMany({
          where: { id: l.skuId, stockCases: { gte: need } },
          data: { stockCases: { decrement: need } },
        });
        if (res.count !== 1) throw new StockRace("stock");
      }

      await tx.orderLine.deleteMany({ where: { orderId: order.id } });
      await tx.orderLine.createMany({
        data: built.lines.map((l) => {
          const old = meta.get(l.skuId);
          return {
            orderId: order.id,
            skuId: l.skuId,
            qtyCases: l.qtyCases,
            freeCases: l.freeCases,
            unitPricePaise: l.item.unitPricePaise,
            grossPaise: l.grossPaise,
            discountPaise: l.discountPaise,
            gstPaise: l.gstPaise,
            schemeLabel: l.schemeLabel,
            originalText: old?.originalText ?? null,
            confidence: old?.confidence ?? null,
          };
        }),
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          action: "REVISE",
          byName: input.byName,
          note: `Changed ${line.sku.name} to ${newSku.name}`,
        },
      });
    });
  } catch (e) {
    if (e instanceof StockRace) return { ok: false, reason: e.message === "stock" ? "stock" : "not_allowed" };
    throw e;
  }

  // Teach the matcher, unless the old product was simply out of stock.
  let learned = false;
  if (line.originalText && line.sku.stockCases > 0) {
    const parsed = extractLine(line.originalText);
    if (parsed) {
      const key = aliasKey(parsed);
      if (key && key.length <= 80) {
        await db.alias.upsert({
          where: { retailerId_phrase: { retailerId: order.retailerId, phrase: key } },
          create: { retailerId: order.retailerId, phrase: key, skuId: input.newSkuId },
          update: { skuId: input.newSkuId },
        });
        learned = true;
      }
    }
  }
  return { ok: true, learned, status };
}
