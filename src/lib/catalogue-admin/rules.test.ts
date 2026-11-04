import { describe, expect, it } from "vitest";
import { isSchemeLive } from "@/lib/pricing/engine";
import {
  describeProductChange,
  describeStockChange,
  istDay,
  paiseToInput,
  parsePercentBp,
  parseRupees,
  schemeLabelFor,
  schemeProblem,
  toIstDateInput,
} from "./rules";
import { ProductBody, SchemeBody, StockBody } from "./schemas";

describe("typing a price", () => {
  it("turns rupees into whole paise", () => {
    expect(parseRupees("7.9")).toBe(790);
    expect(parseRupees("8")).toBe(800);
    expect(parseRupees("1,250.50")).toBe(125050);
    expect(parseRupees("₹ 101.5")).toBe(10150);
    expect(parseRupees("0.05")).toBe(5);
  });
  it("refuses anything that could be a typo rather than guessing", () => {
    for (const bad of ["", "abc", "7.999", "-5", "0", "0.00", "1e3", "7,9,0", "12.", ".5"]) {
      expect(parseRupees(bad), bad).toBeNull();
    }
  });
  it("round-trips a stored price into a form field", () => {
    expect(paiseToInput(790)).toBe("7.90");
    expect(parseRupees(paiseToInput(10150))).toBe(10150);
  });
  it("never goes through floating point for the awkward amounts", () => {
    // 1.15 * 100 is 114.99999999999999 in floating point
    expect(parseRupees("1.15")).toBe(115);
    expect(parseRupees("0.29")).toBe(29);
    expect(parseRupees("4.35")).toBe(435);
  });
});

describe("typing a percentage", () => {
  it("gives basis points", () => {
    expect(parsePercentBp("3")).toBe(300);
    expect(parsePercentBp("2.5%")).toBe(250);
    expect(parsePercentBp("0.01")).toBe(1);
    expect(parsePercentBp("100")).toBe(10000);
  });
  it("refuses nonsense and anything over 100%", () => {
    for (const bad of ["", "0", "-1", "101", "3.333", "abc"]) expect(parsePercentBp(bad), bad).toBeNull();
  });
});

describe("scheme wording", () => {
  it("is built from the rule, so it can never disagree with it", () => {
    expect(schemeLabelFor({ type: "FREE_GOODS", buyQty: 10, freeQty: 1 })).toBe("Buy 10 cases get 1 free");
    expect(schemeLabelFor({ type: "SLAB_PERCENT", minQty: 5, percentBp: 300 })).toBe("3% off 5 or more cases");
    expect(schemeLabelFor({ type: "SLAB_PERCENT", minQty: 20, percentBp: 250 })).toBe("2.5% off 20 or more cases");
  });
  it("refuses a rule that cannot apply", () => {
    expect(schemeProblem({ type: "FREE_GOODS", buyQty: 0, freeQty: 1 })).not.toBeNull();
    expect(schemeProblem({ type: "SLAB_PERCENT", minQty: 5 })).not.toBeNull();
    expect(schemeProblem({ type: "FREE_GOODS", buyQty: 10, freeQty: 1, validFrom: "2026-12-01", validUntil: "2026-11-01" })).toMatch(/end date/);
    expect(schemeProblem({ type: "FREE_GOODS", buyQty: 10, freeQty: 1, validFrom: "2026-11-01", validUntil: "2026-11-01" })).toBeNull();
  });
});

describe("scheme dates picked on the desk", () => {
  it("round-trip through Indian time without sliding a day", () => {
    for (const d of ["2026-11-30", "2026-01-01", "2026-12-31"]) expect(toIstDateInput(istDay(d))).toBe(d);
    expect(toIstDateInput(null)).toBe("");
  });
  it("make a scheme run through the whole last day, and start at the first moment of the first", () => {
    const rule = { type: "FREE_GOODS", buyQty: 10, freeQty: 1, label: "x", validFrom: istDay("2026-11-10"), validUntil: istDay("2026-11-12") } as const;
    expect(isSchemeLive(rule, new Date("2026-11-09T18:29:59Z"))).toBe(false); // 23:59 IST on the 9th
    expect(isSchemeLive(rule, new Date("2026-11-09T18:30:00Z"))).toBe(true); // 00:00 IST on the 10th
    expect(isSchemeLive(rule, new Date("2026-11-12T18:29:59Z"))).toBe(true); // 23:59 IST on the 12th
    expect(isSchemeLive(rule, new Date("2026-11-12T18:30:00Z"))).toBe(false); // 00:00 IST on the 13th
  });
});

describe("history wording", () => {
  const base = { name: "Biscuit", nameHi: null, brand: "A", piecesPerCase: 96, pricePaise: 810, gstRateBp: 1200, active: true };
  it("says nothing when nothing changed", () => {
    expect(describeProductChange(base, { ...base })).toEqual([]);
  });
  it("lists each change in plain words", () => {
    const out = describeProductChange(base, { ...base, pricePaise: 825, gstRateBp: 1800, active: false });
    expect(out).toEqual(["Dealer price ₹8.10 to ₹8.25 per piece", "GST 12% to 18%", "Taken off sale"]);
  });
  it("describes stock moves with the reason", () => {
    expect(describeStockChange(40, 100, "Delivery from godown")).toBe("Stock 40 to 100 cases (+60): Delivery from godown");
    expect(describeStockChange(40, 35, "Damaged")).toBe("Stock 40 to 35 cases (−5): Damaged");
  });
});

describe("what the API accepts", () => {
  const product = { code: "sku-new-1", name: "Rice 1 kg", brand: "Annapurna", piecesPerCase: 10, pricePaise: 6500, gstRateBp: 500 };
  it("normalises the product code and applies defaults", () => {
    const r = ProductBody.parse(product);
    expect(r.code).toBe("SKU-NEW-1");
    expect(r.stockCases).toBe(0);
  });
  it("refuses a bad code, an odd GST rate and a zero price", () => {
    expect(ProductBody.safeParse({ ...product, code: "has space" }).success).toBe(false);
    expect(ProductBody.safeParse({ ...product, gstRateBp: 700 }).success).toBe(false);
    expect(ProductBody.safeParse({ ...product, pricePaise: 0 }).success).toBe(false);
    expect(ProductBody.safeParse({ ...product, piecesPerCase: 0 }).success).toBe(false);
  });
  it("needs a reason for every stock change", () => {
    expect(StockBody.safeParse({ mode: "add", cases: 5, reason: "" }).success).toBe(false);
    expect(StockBody.safeParse({ mode: "add", cases: 5, reason: "Delivery" }).success).toBe(true);
    expect(StockBody.safeParse({ mode: "add", cases: -5, reason: "Delivery" }).success).toBe(false);
  });
  it("takes both scheme types and nothing else", () => {
    expect(SchemeBody.safeParse({ type: "FREE_GOODS", buyQty: 10, freeQty: 1 }).success).toBe(true);
    expect(SchemeBody.safeParse({ type: "SLAB_PERCENT", minQty: 5, percentBp: 300 }).success).toBe(true);
    expect(SchemeBody.safeParse({ type: "FREE_GOODS", minQty: 5 }).success).toBe(false);
    expect(SchemeBody.safeParse({ type: "BOGO", buyQty: 1, freeQty: 1 }).success).toBe(false);
    expect(SchemeBody.safeParse({ type: "SLAB_PERCENT", minQty: 5, percentBp: 0 }).success).toBe(false);
  });
});
