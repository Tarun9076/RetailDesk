import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { loadCatalogue } from "@/lib/catalogue";
import { captureForOrder } from "@/lib/capture/service";
import { buildOrder, type RequestedLine } from "./build";
import { checkCredit } from "./credit";
import { getCreditPosition } from "./exposure";
import type { LineIssue } from "@/lib/pricing/types";
import type { PlacedLine } from "./place-types";

export type PlaceResult =
  | {
      ok: true;
      orderId: string;
      number: string;
      status: "PLACED" | "ON_HOLD";
      duplicate: boolean;
      totalPaise: number;
      lines: PlacedLine[];
    }
  | { ok: false; reason: "empty" | "unknown_sku" }
  | { ok: false; reason: "stock"; issues: { skuId: string; issue: LineIssue }[] };

class StockRace extends Error {
  constructor(public skuId: string) {
    super("stock changed while placing the order");
  }
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function placeOrder(input: {
  retailerId: string;
  lines: RequestedLine[];
  note?: string;
  idempotencyKey: string;
  /** Set when the cart came from a reviewed AI capture. */
  captureId?: string;
  /** Set when a salesman entered the order for the shop. */
  placedById?: string;
  /** When a salesman's phone took the order, if it was offline and sent it later. */
  capturedAt?: Date;
}): Promise<PlaceResult> {
  // Scoped per retailer, so one shop's key can never collide with or reveal another's.
  const key = `${input.retailerId}:${input.idempotencyKey}`;
  const existing = await findByKey(key);
  if (existing) return existing;

  const catalogue = await loadCatalogue(input.retailerId);
  const built = buildOrder(catalogue, input.lines);
  if (!built.ok) return built;

  const { priced } = built;
  // Only a capture that belongs to this shop, was reviewed, and is unused counts.
  const capture = input.captureId ? await captureForOrder(input.retailerId, input.captureId) : null;
  const position = await getCreditPosition(input.retailerId);
  const credit = checkCredit(position.limitPaise, position.usedPaise, priced.totalPaise);
  const status = credit.hold ? "ON_HOLD" : "PLACED";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await db.$transaction(async (tx) => {
        // Reserve stock atomically: the update only matches while enough is left,
        // so two retailers cannot both take the last cases.
        for (const l of built.lines) {
          const need = l.qtyCases + l.freeCases;
          const res = await tx.sku.updateMany({
            where: { id: l.skuId, stockCases: { gte: need } },
            data: { stockCases: { decrement: need } },
          });
          if (res.count !== 1) throw new StockRace(l.skuId);
        }
        const number = `RD-${String((await tx.order.count()) + 1).padStart(6, "0")}`;
        const created = await tx.order.create({
          data: {
            number,
            idempotencyKey: key,
            retailerId: input.retailerId,
            status,
            source: capture ? "AI_TEXT" : "CATALOGUE",
            holdReason: credit.reason,
            note: input.note?.trim() || null,
            placedById: input.placedById ?? null,
            capturedAt: input.capturedAt ?? null,
            rawMessage: capture?.rawText ?? null,
            subtotalPaise: priced.subtotalPaise,
            discountPaise: priced.discountPaise,
            gstPaise: priced.gstPaise,
            totalPaise: priced.totalPaise,
            lines: {
              create: built.lines.map((l) => ({
                skuId: l.skuId,
                qtyCases: l.qtyCases,
                freeCases: l.freeCases,
                unitPricePaise: l.item.unitPricePaise,
                grossPaise: l.grossPaise,
                discountPaise: l.discountPaise,
                gstPaise: l.gstPaise,
                schemeLabel: l.schemeLabel,
                originalText: capture?.bySku.get(l.skuId)?.originalText ?? null,
                confidence: capture?.bySku.get(l.skuId)?.confidence ?? null,
              })),
            },
          },
        });
        // One capture becomes one order, never two.
        if (capture) {
          await tx.aiCapture.updateMany({
            where: { id: capture.id, status: "DRAFT" },
            data: { status: "CONFIRMED" },
          });
        }
        return created;
      });
      return {
        ok: true,
        orderId: order.id,
        number: order.number,
        status,
        duplicate: false,
        totalPaise: priced.totalPaise,
        lines: priced.lines.map((l) => ({
          skuId: l.skuId,
          qtyCases: l.qtyCases,
          freeCases: l.freeCases,
          totalPaise: l.totalPaise,
        })),
      };
    } catch (e) {
      if (e instanceof StockRace) {
        const fresh = buildOrder(await loadCatalogue(input.retailerId), input.lines);
        return fresh.ok
          ? { ok: false, reason: "stock", issues: [{ skuId: e.skuId, issue: { code: "OUT_OF_STOCK" } }] }
          : fresh;
      }
      if (isUniqueViolation(e)) {
        // Either a double submit (same key) or two orders took the same number.
        const dup = await findByKey(key);
        if (dup) return dup;
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not allocate an order number");
}

async function findByKey(key: string): Promise<PlaceResult | null> {
  const o = await db.order.findUnique({ where: { idempotencyKey: key }, include: { lines: true } });
  if (!o) return null;
  return {
    ok: true,
    orderId: o.id,
    number: o.number,
    status: o.status === "ON_HOLD" ? "ON_HOLD" : "PLACED",
    duplicate: true,
    totalPaise: o.totalPaise,
    lines: o.lines.map((l) => ({
      skuId: l.skuId,
      qtyCases: l.qtyCases,
      freeCases: l.freeCases,
      totalPaise: l.grossPaise - l.discountPaise + l.gstPaise,
    })),
  };
}
