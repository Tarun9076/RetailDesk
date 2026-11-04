import { priceOrder } from "@/lib/pricing/engine";
import type { LineIssue, PricedLine, PricedOrder } from "@/lib/pricing/types";
import type { CatalogueItem } from "@/lib/catalogue-types";

export interface RequestedLine {
  skuId: string;
  qtyCases: number;
}

export type BuildResult =
  | { ok: true; priced: PricedOrder; lines: (PricedLine & { item: CatalogueItem })[] }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "unknown_sku"; skuId: string }
  | { ok: false; reason: "stock"; issues: { skuId: string; issue: LineIssue }[] };

/**
 * Prices a request against the retailer's own catalogue. This is the single
 * authority for an order's money: the browser shows a preview with the same
 * engine, but whatever it sent is only a list of SKUs and case counts.
 */
export function buildOrder(
  catalogue: CatalogueItem[],
  requested: RequestedLine[],
  now: Date = new Date(),
): BuildResult {
  const byId = new Map(catalogue.map((c) => [c.id, c]));

  // Merge duplicate SKUs so the same item cannot dodge a threshold by splitting.
  const merged = new Map<string, number>();
  for (const r of requested) {
    if (r.qtyCases <= 0) continue;
    merged.set(r.skuId, (merged.get(r.skuId) ?? 0) + r.qtyCases);
  }
  if (merged.size === 0) return { ok: false, reason: "empty" };

  const items: CatalogueItem[] = [];
  for (const skuId of merged.keys()) {
    const item = byId.get(skuId);
    if (!item) return { ok: false, reason: "unknown_sku", skuId };
    items.push(item);
  }

  const priced = priceOrder(
    items.map((item) => ({
      skuId: item.id,
      qtyCases: merged.get(item.id)!,
      unitPricePaise: item.unitPricePaise,
      piecesPerCase: item.piecesPerCase,
      gstRateBp: item.gstRateBp,
      stockCases: item.stockCases,
      scheme: item.schemes,
    })),
    now,
  );

  if (priced.hasIssues) {
    return {
      ok: false,
      reason: "stock",
      issues: priced.lines.flatMap((l) => (l.issue ? [{ skuId: l.skuId, issue: l.issue }] : [])),
    };
  }
  return { ok: true, priced, lines: priced.lines.map((l, i) => ({ ...l, item: items[i] })) };
}
