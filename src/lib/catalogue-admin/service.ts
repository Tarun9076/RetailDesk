import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import type { z } from "zod";
import {
  describeProductChange,
  describeStockChange,
  istDay,
  schemeLabelFor,
  schemeProblem,
} from "./rules";
import type { ProductBody, ProductPatch, SchemeBody, SchemePatch, StockBody } from "./schemas";

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

const log = (tx: Prisma.TransactionClient, skuId: string, kind: string, summary: string, byName: string) =>
  tx.catalogueEvent.create({ data: { skuId, kind, summary, byName } });

// ---------------------------------------------------------------- products

export async function createProduct(input: z.infer<typeof ProductBody>, byName: string) {
  try {
    return await db.$transaction(async (tx) => {
      const sku = await tx.sku.create({
        data: {
          code: input.code,
          name: input.name,
          nameHi: input.nameHi || null,
          brand: input.brand,
          piecesPerCase: input.piecesPerCase,
          pricePaise: input.pricePaise,
          gstRateBp: input.gstRateBp,
          stockCases: input.stockCases,
        },
        select: { id: true },
      });
      await log(
        tx,
        sku.id,
        "PRODUCT_CREATED",
        `Product added at ${formatPaise(input.pricePaise)} per piece, GST ${input.gstRateBp / 100}%, opening stock ${input.stockCases} cases`,
        byName,
      );
      return { ok: true as const, id: sku.id };
    });
  } catch (e) {
    if (isUnique(e)) return { ok: false as const, reason: "code_taken" as const };
    throw e;
  }
}

export async function updateProduct(id: string, patch: z.infer<typeof ProductPatch>, byName: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.sku.findUnique({ where: { id } });
    if (!before) return { ok: false as const, reason: "not_found" as const };
    const after = {
      name: patch.name,
      nameHi: patch.nameHi || null,
      brand: patch.brand,
      piecesPerCase: patch.piecesPerCase,
      pricePaise: patch.pricePaise,
      gstRateBp: patch.gstRateBp,
      active: patch.active,
    };
    const changes = describeProductChange(before, after);
    if (changes.length === 0) return { ok: true as const, changed: false };
    await tx.sku.update({ where: { id }, data: after });
    await log(tx, id, "PRODUCT_UPDATED", changes.join("; "), byName);
    return { ok: true as const, changed: true };
  });
}

// ---------------------------------------------------------------- stock

export type StockResult =
  | { ok: true; before: number; after: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "below_zero"; available: number }
  | { ok: false; reason: "changed"; current: number };

/**
 * Changes stock without ever losing a concurrent order. Adding and removing are
 * single atomic updates (removing only matches while enough is left). "Set to"
 * only applies if the level is still what the desk was looking at, because an
 * order arriving meanwhile would otherwise be silently overwritten.
 */
export async function adjustStock(skuId: string, b: z.infer<typeof StockBody>, byName: string): Promise<StockResult> {
  return db.$transaction(async (tx) => {
    const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { stockCases: true } });
    if (!sku) return { ok: false, reason: "not_found" };

    let before: number;
    let after: number;
    if (b.mode === "add") {
      const r = await tx.sku.update({ where: { id: skuId }, data: { stockCases: { increment: b.cases } }, select: { stockCases: true } });
      after = r.stockCases;
      before = after - b.cases;
    } else if (b.mode === "remove") {
      const r = await tx.sku.updateMany({ where: { id: skuId, stockCases: { gte: b.cases } }, data: { stockCases: { decrement: b.cases } } });
      if (r.count !== 1) return { ok: false, reason: "below_zero", available: sku.stockCases };
      after = (await tx.sku.findUniqueOrThrow({ where: { id: skuId }, select: { stockCases: true } })).stockCases;
      before = after + b.cases;
    } else {
      const expected = b.expected ?? sku.stockCases;
      const r = await tx.sku.updateMany({ where: { id: skuId, stockCases: expected }, data: { stockCases: b.cases } });
      if (r.count !== 1) {
        const now = await tx.sku.findUniqueOrThrow({ where: { id: skuId }, select: { stockCases: true } });
        return { ok: false, reason: "changed", current: now.stockCases };
      }
      before = expected;
      after = b.cases;
    }
    if (before !== after) await log(tx, skuId, "STOCK_ADJUSTED", describeStockChange(before, after, b.reason), byName);
    return { ok: true, before, after };
  });
}

// ---------------------------------------------------------------- schemes

export async function addScheme(skuId: string, b: z.infer<typeof SchemeBody>, byName: string) {
  const problem = schemeProblem(b);
  if (problem) return { ok: false as const, reason: "invalid" as const, message: problem };
  const label = schemeLabelFor(b);
  return db.$transaction(async (tx) => {
    if (!(await tx.sku.findUnique({ where: { id: skuId }, select: { id: true } }))) {
      return { ok: false as const, reason: "not_found" as const };
    }
    // The same rule twice would only confuse the desk; the engine would treat them as one.
    const same = await tx.scheme.findFirst({
      where: b.type === "FREE_GOODS"
        ? { skuId, active: true, type: "FREE_GOODS", buyQty: b.buyQty, freeQty: b.freeQty }
        : { skuId, active: true, type: "SLAB_PERCENT", minQty: b.minQty, percentBp: b.percentBp },
    });
    if (same) return { ok: false as const, reason: "duplicate" as const };
    const s = await tx.scheme.create({
      data: {
        skuId,
        type: b.type,
        ...(b.type === "FREE_GOODS" ? { buyQty: b.buyQty, freeQty: b.freeQty } : { minQty: b.minQty, percentBp: b.percentBp }),
        label,
        validFrom: b.validFrom ? istDay(b.validFrom) : null,
        validUntil: b.validUntil ? istDay(b.validUntil) : null,
      },
      select: { id: true },
    });
    const dates = b.validFrom || b.validUntil ? ` (${b.validFrom ?? "now"} to ${b.validUntil ?? "no end"})` : "";
    await log(tx, skuId, "SCHEME_ADDED", `Scheme added: ${label}${dates}`, byName);
    return { ok: true as const, id: s.id };
  });
}

export async function patchScheme(id: string, p: z.infer<typeof SchemePatch>, byName: string) {
  return db.$transaction(async (tx) => {
    const s = await tx.scheme.findUnique({ where: { id } });
    if (!s) return { ok: false as const, reason: "not_found" as const };
    const validFrom = p.validFrom === undefined ? s.validFrom : p.validFrom ? istDay(p.validFrom) : null;
    const validUntil = p.validUntil === undefined ? s.validUntil : p.validUntil ? istDay(p.validUntil) : null;
    if (validFrom && validUntil && validUntil < validFrom) {
      return { ok: false as const, reason: "invalid" as const, message: "The end date is before the start date." };
    }
    await tx.scheme.update({ where: { id }, data: { active: p.active ?? s.active, validFrom, validUntil } });
    const what: string[] = [];
    if (p.active !== undefined && p.active !== s.active) what.push(p.active ? "switched on" : "switched off");
    if (p.validFrom !== undefined || p.validUntil !== undefined) what.push("dates changed");
    if (what.length) await log(tx, s.skuId, "SCHEME_CHANGED", `${s.label}: ${what.join(", ")}`, byName);
    return { ok: true as const };
  });
}

export async function removeScheme(id: string, byName: string) {
  return db.$transaction(async (tx) => {
    const s = await tx.scheme.findUnique({ where: { id } });
    if (!s) return { ok: false as const, reason: "not_found" as const };
    await tx.scheme.delete({ where: { id } });
    await log(tx, s.skuId, "SCHEME_REMOVED", `Scheme removed: ${s.label}`, byName);
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------- shop prices

export async function setShopPrice(skuId: string, retailerId: string, pricePaise: number, byName: string) {
  return db.$transaction(async (tx) => {
    const [sku, shop, existing] = await Promise.all([
      tx.sku.findUnique({ where: { id: skuId }, select: { pricePaise: true } }),
      tx.retailer.findUnique({ where: { id: retailerId }, select: { shopName: true } }),
      tx.retailerPrice.findUnique({ where: { retailerId_skuId: { retailerId, skuId } } }),
    ]);
    if (!sku || !shop) return { ok: false as const, reason: "not_found" as const };
    await tx.retailerPrice.upsert({
      where: { retailerId_skuId: { retailerId, skuId } },
      create: { retailerId, skuId, pricePaise },
      update: { pricePaise },
    });
    const from = existing ? formatPaise(existing.pricePaise) : `dealer price ${formatPaise(sku.pricePaise)}`;
    await log(tx, skuId, "SHOP_PRICE_SET", `${shop.shopName}: ${from} to ${formatPaise(pricePaise)} per piece`, byName);
    return { ok: true as const };
  });
}

export async function removeShopPrice(skuId: string, retailerId: string, byName: string) {
  return db.$transaction(async (tx) => {
    const [existing, shop] = await Promise.all([
      tx.retailerPrice.findUnique({ where: { retailerId_skuId: { retailerId, skuId } } }),
      tx.retailer.findUnique({ where: { id: retailerId }, select: { shopName: true } }),
    ]);
    if (!existing || !shop) return { ok: false as const, reason: "not_found" as const };
    await tx.retailerPrice.delete({ where: { retailerId_skuId: { retailerId, skuId } } });
    await log(tx, skuId, "SHOP_PRICE_REMOVED", `${shop.shopName}: own price ${formatPaise(existing.pricePaise)} removed, back to the dealer price`, byName);
    return { ok: true as const };
  });
}
