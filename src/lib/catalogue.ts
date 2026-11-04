import "server-only";
import { db } from "@/lib/db";
import { compareSchemes, isSchemeLive } from "@/lib/pricing/engine";
import type { SchemeRule } from "@/lib/pricing/types";
import type { CatalogueItem } from "@/lib/catalogue-types";

/**
 * The catalogue as one specific retailer sees it: their own price where the
 * distributor has set one, otherwise the dealer price. Prices are never
 * returned for any other retailer.
 */
export async function loadCatalogue(
  retailerId: string,
  now: Date = new Date(),
): Promise<CatalogueItem[]> {
  // Three independent reads sent together: one wait instead of two in a row
  // (a Prisma "include" fetches the schemes in a second step, after the products).
  const [skus, schemeRows, overrides] = await Promise.all([
    db.sku.findMany({
      where: { active: true },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
    }),
    db.scheme.findMany({ where: { active: true } }),
    db.retailerPrice.findMany({ where: { retailerId } }),
  ]);
  const override = new Map(overrides.map((o) => [o.skuId, o.pricePaise]));
  const schemesBySku = new Map<string, typeof schemeRows>();
  for (const r of schemeRows) schemesBySku.set(r.skuId, [...(schemesBySku.get(r.skuId) ?? []), r]);

  return skus.map((s) => {
    const schemes = liveSchemes(schemesBySku.get(s.id) ?? [], now);
    const unitPricePaise = override.get(s.id) ?? s.pricePaise;
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      nameHi: s.nameHi,
      brand: s.brand,
      piecesPerCase: s.piecesPerCase,
      unitPricePaise,
      casePricePaise: unitPricePaise * s.piecesPerCase,
      gstRateBp: s.gstRateBp,
      stockCases: s.stockCases,
      schemes,
    };
  });
}

/** Every live scheme of a product, in a fixed order and without dates. The engine picks the best one per quantity. */
export function liveSchemes(rows: SchemeRow[], now: Date): SchemeRule[] {
  return rows
    .map(toRule)
    .filter((r): r is SchemeRule => r !== null && isSchemeLive(r, now))
    .sort(compareSchemes)
    .map((r) => ({ ...r, validFrom: null, validUntil: null }));
}

type SchemeRow = {
  type: "FREE_GOODS" | "SLAB_PERCENT";
  buyQty: number | null;
  freeQty: number | null;
  minQty: number | null;
  percentBp: number | null;
  label: string;
  active: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
};

/** Maps a database row to an engine rule. Malformed rows are dropped, not guessed at. */
export function toRule(s: SchemeRow): SchemeRule | null {
  const common = { label: s.label, active: s.active, validFrom: s.validFrom, validUntil: s.validUntil };
  if (s.type === "FREE_GOODS" && s.buyQty && s.freeQty) {
    return { type: "FREE_GOODS", buyQty: s.buyQty, freeQty: s.freeQty, ...common };
  }
  if (s.type === "SLAB_PERCENT" && s.minQty && s.percentBp) {
    return { type: "SLAB_PERCENT", minQty: s.minQty, percentBp: s.percentBp, ...common };
  }
  return null;
}
