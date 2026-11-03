import { describe, expect, it } from "vitest";
import { freeCasesFor, maxOrderableCases, priceLine, priceOrder } from "./engine";
import type { PricingLineInput, SchemeRule } from "./types";

const NOW = new Date("2026-11-04T10:00:00Z");

const BUY10_GET1: SchemeRule = {
  type: "FREE_GOODS",
  buyQty: 10,
  freeQty: 1,
  label: "Buy 10 cases get 1 free",
};
const SLAB_3: SchemeRule = {
  type: "SLAB_PERCENT",
  minQty: 5,
  percentBp: 300,
  label: "3% off 5 or more cases",
};

// Sample data from the brief. Prices are per piece, GST-exclusive.
const biscuit = (qty: number, over: Partial<PricingLineInput> = {}): PricingLineInput => ({
  skuId: "SKU-BS-075",
  qtyCases: qty,
  unitPricePaise: 810,
  piecesPerCase: 96,
  gstRateBp: 1200,
  stockCases: 340,
  scheme: BUY10_GET1,
  ...over,
});
const detergent = (qty: number, over: Partial<PricingLineInput> = {}): PricingLineInput => ({
  skuId: "SKU-DT-1KG",
  qtyCases: qty,
  unitPricePaise: 10150,
  piecesPerCase: 20,
  gstRateBp: 1800,
  stockCases: 85,
  scheme: SLAB_3,
  ...over,
});
const tea = (qty: number): PricingLineInput => ({
  skuId: "SKU-TE-250",
  qtyCases: qty,
  unitPricePaise: 11800,
  piecesPerCase: 40,
  gstRateBp: 1200,
  stockCases: 0,
  scheme: null,
});

describe("free goods (buy 10 get 1)", () => {
  it("gives nothing below the threshold and hints how many to add", () => {
    const l = priceLine(biscuit(9), NOW);
    expect(l.freeCases).toBe(0);
    expect(l.schemeLabel).toBeNull();
    expect(l.hint).toBe("Add 1 more case to get 1 case free");
  });

  it("gives 1 free at exactly 10 cases and prices only paid cases", () => {
    const l = priceLine(biscuit(10), NOW);
    expect(l.freeCases).toBe(1);
    expect(l.grossPaise).toBe(10 * 96 * 810); // 777,600
    expect(l.gstPaise).toBe(93_312); // 12% of 777,600, none on the free case
    expect(l.totalPaise).toBe(870_912);
    expect(l.schemeLabel).toBe("Buy 10 cases get 1 free");
  });

  it("is a step function: 19 -> 1 free, 20 -> 2 free, 25 -> 2 free", () => {
    expect(freeCasesFor(BUY10_GET1, 19)).toBe(1);
    expect(freeCasesFor(BUY10_GET1, 20)).toBe(2);
    expect(freeCasesFor(BUY10_GET1, 25)).toBe(2);
    expect(priceLine(biscuit(25), NOW).hint).toBe("Add 5 more cases to get 1 case free");
  });

  it("supports other ratios such as buy 5 get 2", () => {
    expect(freeCasesFor({ ...BUY10_GET1, buyQty: 5, freeQty: 2 }, 12)).toBe(4);
  });
});

describe("slab discount (3% off 5+ cases)", () => {
  it("gives no discount at 4 cases and hints", () => {
    const l = priceLine(detergent(4), NOW);
    expect(l.discountPaise).toBe(0);
    expect(l.hint).toBe("Add 1 more case for 3% off");
  });

  it("applies 3% to the whole line at 5 cases, GST on the discounted amount", () => {
    const l = priceLine(detergent(5), NOW);
    expect(l.grossPaise).toBe(1_015_000); // 5 x 20 x 101.50
    expect(l.discountPaise).toBe(30_450);
    expect(l.taxablePaise).toBe(984_550);
    expect(l.gstPaise).toBe(177_219); // 18%
    expect(l.totalPaise).toBe(1_161_769);
    expect(l.hint).toBeNull();
  });

  it("rounds discount half up to whole paise", () => {
    // 1 piece case at 1.50 -> 3% of 150 paise = 4.5 -> 5
    const l = priceLine(
      { ...detergent(5), unitPricePaise: 30, piecesPerCase: 1 },
      NOW,
    ); // gross 150
    expect(l.discountPaise).toBe(5);
  });
});

describe("stock", () => {
  it("flags out of stock (tea has 0 cases)", () => {
    const l = priceLine(tea(1), NOW);
    expect(l.issue).toEqual({ code: "OUT_OF_STOCK" });
  });

  it("counts free cases against stock", () => {
    // 340 paid + 34 free = 374 > 340
    const l = priceLine(biscuit(340), NOW);
    expect(l.issue).toEqual({
      code: "INSUFFICIENT_STOCK",
      availableCases: 340,
      maxOrderableCases: 309,
    });
  });

  it("309 cases is the largest order that fits (309 + 30 free = 339)", () => {
    expect(maxOrderableCases(340, BUY10_GET1)).toBe(309);
    expect(priceLine(biscuit(309), NOW).issue).toBeNull();
    expect(priceLine(biscuit(310), NOW).issue).not.toBeNull();
  });

  it("max orderable equals stock when there is no free-goods scheme", () => {
    expect(maxOrderableCases(85, SLAB_3)).toBe(85);
    expect(maxOrderableCases(0, null)).toBe(0);
  });
});

describe("scheme validity", () => {
  it("ignores inactive and expired schemes", () => {
    expect(priceLine(biscuit(10, { scheme: { ...BUY10_GET1, active: false } }), NOW).freeCases).toBe(0);
    const expired = { ...BUY10_GET1, validUntil: new Date("2026-10-31T00:00:00Z") };
    expect(priceLine(biscuit(10, { scheme: expired }), NOW).freeCases).toBe(0);
  });

  it("ignores schemes that have not started", () => {
    const future = { ...BUY10_GET1, validFrom: new Date("2026-12-01T00:00:00Z") };
    expect(priceLine(biscuit(10, { scheme: future }), NOW).freeCases).toBe(0);
  });

  it("applies a scheme inside its validity window", () => {
    const ok = {
      ...BUY10_GET1,
      validFrom: new Date("2026-11-01T00:00:00Z"),
      validUntil: new Date("2026-11-30T00:00:00Z"),
    };
    expect(priceLine(biscuit(10, { scheme: ok }), NOW).freeCases).toBe(1);
  });
});

describe("input validation", () => {
  it("rejects fractional, negative and NaN quantities", () => {
    expect(() => priceLine(biscuit(1.5), NOW)).toThrow(RangeError);
    expect(() => priceLine(biscuit(-1), NOW)).toThrow(RangeError);
    expect(() => priceLine(biscuit(Number.NaN), NOW)).toThrow(RangeError);
  });

  it("prices zero cases as zero with no hint", () => {
    const l = priceLine(biscuit(0), NOW);
    expect(l.totalPaise).toBe(0);
    expect(l.hint).toBeNull();
    expect(l.issue).toBeNull();
  });
});

describe("priceOrder", () => {
  it("sums the sample order and flags the out-of-stock line", () => {
    const o = priceOrder([biscuit(10), detergent(5), tea(1)], NOW);
    expect(o.lines).toHaveLength(3);
    expect(o.subtotalPaise).toBe(777_600 + 1_015_000 + 40 * 11800);
    expect(o.discountPaise).toBe(30_450);
    expect(o.hasIssues).toBe(true);
  });

  it("total equals the sum of line totals", () => {
    const o = priceOrder([biscuit(10), detergent(5)], NOW);
    expect(o.totalPaise).toBe(870_912 + 1_161_769);
    expect(o.hasIssues).toBe(false);
  });
});
