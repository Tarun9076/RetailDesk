import { describe, expect, it } from "vitest";
import { freeCasesFor, maxOrderableCases, priceLine, priceOrder } from "./engine";
import type { PricingLineInput, SchemeRule } from "./types";

const NOW = new Date("2026-11-04T10:00:00Z");

// A fixed-seed random generator, so these tests run the same every time.
let seed = 987654321;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/**
 * A second, independent calculator. It uses exact BigInt arithmetic, never
 * floating point, and rounds half up with integer division, so a bug in the
 * engine's number handling cannot hide behind the same bug here.
 */
function reference(i: PricingLineInput) {
  const qty = BigInt(i.qtyCases);
  const gross = qty * BigInt(i.piecesPerCase) * BigInt(i.unitPricePaise);
  const [ZERO, TWO, BPS] = [BigInt(0), BigInt(2), BigInt(10000)];
  const roundDiv = (num: bigint, den: bigint) => (TWO * num + den) / (TWO * den); // half up
  let discount = ZERO;
  let free = ZERO;
  const s = Array.isArray(i.scheme) ? null : i.scheme; // this test uses one scheme per line
  if (s?.type === "SLAB_PERCENT" && i.qtyCases >= s.minQty) discount = roundDiv(gross * BigInt(s.percentBp), BPS);
  if (s?.type === "FREE_GOODS") free = (qty / BigInt(s.buyQty)) * BigInt(s.freeQty);
  const taxable = gross - discount;
  const gst = roundDiv(taxable * BigInt(i.gstRateBp), BPS);
  return { gross, discount, free, taxable, gst, total: taxable + gst };
}

const FREE = (buy: number, free: number): SchemeRule => ({ type: "FREE_GOODS", buyQty: buy, freeQty: free, label: "x" });
const SLAB = (min: number, bp: number): SchemeRule => ({ type: "SLAB_PERCENT", minQty: min, percentBp: bp, label: "x" });

function randomLine(): PricingLineInput {
  const kind = int(0, 2);
  return {
    skuId: "s",
    qtyCases: int(0, 400),
    unitPricePaise: int(1, 50_000), // up to ₹500 a piece
    piecesPerCase: int(1, 200),
    gstRateBp: [0, 500, 1200, 1800, 2800][int(0, 4)],
    stockCases: 1_000_000,
    scheme: kind === 0 ? null : kind === 1 ? FREE(int(1, 25), int(1, 5)) : SLAB(int(1, 30), int(1, 2500)),
  };
}

describe("engine versus an independent exact calculator", () => {
  it("agrees to the paisa on 20,000 random lines", () => {
    for (let n = 0; n < 20_000; n++) {
      const input = randomLine();
      const got = priceLine(input, NOW);
      const want = reference(input);
      expect(BigInt(got.grossPaise), JSON.stringify(input)).toBe(want.gross);
      expect(BigInt(got.discountPaise), JSON.stringify(input)).toBe(want.discount);
      expect(BigInt(got.freeCases), JSON.stringify(input)).toBe(want.free);
      expect(BigInt(got.gstPaise), JSON.stringify(input)).toBe(want.gst);
      expect(BigInt(got.totalPaise), JSON.stringify(input)).toBe(want.total);
    }
  });

  it("rounds an exact half-paisa upwards, never to even", () => {
    // 1 case x 1 piece x 50 paise at 1% = 0.5 paise -> must round to 1
    const l = priceLine(
      { skuId: "s", qtyCases: 1, unitPricePaise: 50, piecesPerCase: 1, gstRateBp: 0, stockCases: 9, scheme: SLAB(1, 100) },
      NOW,
    );
    expect(l.discountPaise).toBe(1);
    // and 150 paise at 1% = 1.5 -> 2
    const m = priceLine(
      { skuId: "s", qtyCases: 1, unitPricePaise: 150, piecesPerCase: 1, gstRateBp: 0, stockCases: 9, scheme: SLAB(1, 100) },
      NOW,
    );
    expect(m.discountPaise).toBe(2);
  });
});

describe("rules that must hold for every order", () => {
  it("money adds up and a discount is never negative or bigger than the goods", () => {
    for (let n = 0; n < 5_000; n++) {
      const l = priceLine(randomLine(), NOW);
      expect(l.discountPaise).toBeGreaterThanOrEqual(0);
      expect(l.discountPaise).toBeLessThanOrEqual(l.grossPaise);
      expect(l.taxablePaise).toBe(l.grossPaise - l.discountPaise);
      expect(l.totalPaise).toBe(l.taxablePaise + l.gstPaise);
      expect(Number.isInteger(l.totalPaise)).toBe(true);
    }
  });

  it("an order is exactly the sum of its lines, whatever the order of the lines", () => {
    const lines = Array.from({ length: 12 }, randomLine);
    const a = priceOrder(lines, NOW);
    const b = priceOrder([...lines].reverse(), NOW);
    expect(a.totalPaise).toBe(b.totalPaise);
    expect(a.totalPaise).toBe(a.subtotalPaise - a.discountPaise + a.gstPaise);
  });

  it("free cases never go down when a shop orders more", () => {
    for (let n = 0; n < 200; n++) {
      const s = FREE(int(1, 25), int(1, 5));
      let prev = 0;
      for (let q = 0; q <= 300; q++) {
        const f = freeCasesFor(s, q);
        expect(f).toBeGreaterThanOrEqual(prev);
        prev = f;
      }
    }
  });

  it("with the sample schemes, ordering more never costs less (no pricing cliff)", () => {
    const biscuit = (q: number) =>
      priceLine({ skuId: "b", qtyCases: q, unitPricePaise: 810, piecesPerCase: 96, gstRateBp: 1200, stockCases: 1e6, scheme: FREE(10, 1) }, NOW).totalPaise;
    const detergent = (q: number) =>
      priceLine({ skuId: "d", qtyCases: q, unitPricePaise: 10150, piecesPerCase: 20, gstRateBp: 1800, stockCases: 1e6, scheme: SLAB(5, 300) }, NOW).totalPaise;
    for (let q = 1; q < 200; q++) {
      expect(biscuit(q + 1)).toBeGreaterThan(biscuit(q));
      expect(detergent(q + 1)).toBeGreaterThan(detergent(q));
    }
  });
});

describe("stock limit with free goods", () => {
  it("the largest orderable quantity is exactly the boundary, for every stock level", () => {
    for (const scheme of [null, FREE(10, 1), FREE(5, 2), FREE(1, 1), SLAB(5, 300)]) {
      for (let stock = 0; stock <= 450; stock++) {
        const q = maxOrderableCases(stock, scheme);
        expect(q + freeCasesFor(scheme, q)).toBeLessThanOrEqual(stock); // it fits
        if (q < stock) expect(q + 1 + freeCasesFor(scheme, q + 1)).toBeGreaterThan(stock); // one more does not
      }
    }
  });

  it("an order is flagged as a stock problem exactly when it does not fit", () => {
    for (let n = 0; n < 3_000; n++) {
      const stock = int(0, 200);
      const s = [null, FREE(int(1, 12), int(1, 3))][int(0, 1)] as SchemeRule | null;
      const qty = int(0, 220);
      const l = priceLine({ skuId: "s", qtyCases: qty, unitPricePaise: 100, piecesPerCase: 10, gstRateBp: 0, stockCases: stock, scheme: s }, NOW);
      const fits = qty + freeCasesFor(s, qty) <= stock;
      expect(l.issue === null).toBe(fits || qty === 0);
    }
  });
});
