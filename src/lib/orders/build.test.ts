import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "@/lib/catalogue-types";
import { buildOrder } from "./build";

const NOW = new Date("2026-11-04T10:00:00Z");

const catalogue: CatalogueItem[] = [
  {
    id: "biscuit", code: "SKU-BS-075", name: "Glucose biscuit", nameHi: null, brand: "A",
    piecesPerCase: 96, unitPricePaise: 790, casePricePaise: 790 * 96, gstRateBp: 1200, stockCases: 340,
    imageUrl: null,
    schemes: [{ type: "FREE_GOODS", buyQty: 10, freeQty: 1, label: "Buy 10 cases get 1 free" }],
  },
  {
    id: "detergent", code: "SKU-DT-1KG", name: "Detergent", nameHi: null, brand: "B",
    piecesPerCase: 20, unitPricePaise: 10150, casePricePaise: 203000, gstRateBp: 1800, stockCases: 85,
    imageUrl: null,
    schemes: [{ type: "SLAB_PERCENT", minQty: 5, percentBp: 300, label: "3% off 5 or more cases" }],
  },
  {
    id: "tea", code: "SKU-TE-250", name: "Tea", nameHi: null, brand: "C",
    piecesPerCase: 40, unitPricePaise: 11800, casePricePaise: 472000, gstRateBp: 1200, stockCases: 0,
    imageUrl: null,
    schemes: [],
  },
];

describe("buildOrder", () => {
  it("prices lines with the retailer's own price, not the dealer price", () => {
    const r = buildOrder(catalogue, [{ skuId: "biscuit", qtyCases: 10 }], NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.priced.subtotalPaise).toBe(10 * 96 * 790); // 7.90 override, not 8.10
    expect(r.lines[0].freeCases).toBe(1);
  });

  it("merges duplicate SKUs so a threshold cannot be dodged or doubled", () => {
    const r = buildOrder(
      catalogue,
      [{ skuId: "detergent", qtyCases: 3 }, { skuId: "detergent", qtyCases: 2 }],
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qtyCases).toBe(5);
    expect(r.lines[0].discountPaise).toBeGreaterThan(0); // 3% slab reached
  });

  it("rejects an empty or all-zero order", () => {
    expect(buildOrder(catalogue, [], NOW)).toEqual({ ok: false, reason: "empty" });
    expect(buildOrder(catalogue, [{ skuId: "biscuit", qtyCases: 0 }], NOW)).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects a SKU that is not in this retailer's catalogue", () => {
    expect(buildOrder(catalogue, [{ skuId: "ghost", qtyCases: 1 }], NOW)).toEqual({
      ok: false,
      reason: "unknown_sku",
      skuId: "ghost",
    });
  });

  it("refuses out-of-stock and reports every problem line", () => {
    const r = buildOrder(
      catalogue,
      [{ skuId: "tea", qtyCases: 1 }, { skuId: "detergent", qtyCases: 90 }],
      NOW,
    );
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== "stock") throw new Error("expected stock failure");
    expect(r.issues).toEqual([
      { skuId: "tea", issue: { code: "OUT_OF_STOCK" } },
      { skuId: "detergent", issue: { code: "INSUFFICIENT_STOCK", availableCases: 85, maxOrderableCases: 85 } },
    ]);
  });

  it("counts free cases against stock", () => {
    const r = buildOrder(catalogue, [{ skuId: "biscuit", qtyCases: 340 }], NOW);
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== "stock") throw new Error("expected stock failure");
    expect(r.issues[0].issue).toMatchObject({ code: "INSUFFICIENT_STOCK", maxOrderableCases: 309 });
  });

  it("totals a multi-line order", () => {
    const r = buildOrder(
      catalogue,
      [{ skuId: "biscuit", qtyCases: 10 }, { skuId: "detergent", qtyCases: 5 }],
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.priced.totalPaise).toBe(r.lines.reduce((s, l) => s + l.totalPaise, 0));
    expect(r.priced.discountPaise).toBe(30_450);
  });
});
