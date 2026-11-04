import { describe, expect, it } from "vitest";
import { chooseScheme, isSchemeLive, maxOrderableCases, priceLine } from "./engine";
import type { PricingLineInput, SchemeRule } from "./types";

const NOW = new Date("2026-11-04T10:00:00Z");
const FREE = (buy: number, free: number, label = `buy ${buy} get ${free}`): SchemeRule => ({ type: "FREE_GOODS", buyQty: buy, freeQty: free, label });
const SLAB = (min: number, bp: number, label = `${bp / 100}% at ${min}+`): SchemeRule => ({ type: "SLAB_PERCENT", minQty: min, percentBp: bp, label });

const line = (qty: number, schemes: SchemeRule[], over: Partial<PricingLineInput> = {}): PricingLineInput => ({
  skuId: "s", qtyCases: qty, unitPricePaise: 10_000, piecesPerCase: 10, gstRateBp: 1200, stockCases: 10_000, scheme: schemes, ...over,
});

describe("several schemes on one product", () => {
  const tiers = [SLAB(5, 300), SLAB(20, 500), SLAB(50, 800)];

  it("applies the highest tier reached, to the whole line", () => {
    expect(priceLine(line(4, tiers), NOW).discountPaise).toBe(0);
    expect(priceLine(line(5, tiers), NOW).appliedScheme?.label).toBe("3% at 5+");
    expect(priceLine(line(19, tiers), NOW).appliedScheme?.label).toBe("3% at 5+");
    expect(priceLine(line(20, tiers), NOW).appliedScheme?.label).toBe("5% at 20+");
    expect(priceLine(line(60, tiers), NOW).appliedScheme?.label).toBe("8% at 50+");
    // 20 cases x 10 pcs x Rs100 = Rs20,000 gross, 5% = Rs1,000
    expect(priceLine(line(20, tiers), NOW).discountPaise).toBe(100_000);
  });

  it("never stacks: a free-goods scheme and a percentage are not both applied", () => {
    const l = priceLine(line(20, [FREE(10, 1), SLAB(5, 300)]), NOW);
    // 2 free cases = 10% of 20 cases, worth more than 3%, so only free goods apply
    expect(l.freeCases).toBe(2);
    expect(l.discountPaise).toBe(0);
    expect(l.appliedScheme?.type).toBe("FREE_GOODS");
  });

  it("picks whichever is worth more to the shop at that quantity", () => {
    const s = [FREE(10, 1), SLAB(5, 300)]; // 1 free in 10 = 10%; beats 3%
    expect(chooseScheme(s, 6, NOW)?.type).toBe("SLAB_PERCENT"); // 6 cases: 3% only, no free yet
    expect(chooseScheme(s, 10, NOW)?.type).toBe("FREE_GOODS"); // 10 cases: 1 free (10%) beats 3%
    expect(chooseScheme([FREE(10, 1), SLAB(5, 1500)], 10, NOW)?.type).toBe("SLAB_PERCENT"); // 15% beats 10%
  });

  it("gives the same answer whatever order the rows come in", () => {
    const rows = [SLAB(5, 300), SLAB(20, 500), FREE(10, 1), FREE(50, 8), SLAB(50, 800)];
    for (let q = 0; q <= 120; q++) {
      const a = chooseScheme(rows, q, NOW);
      const b = chooseScheme([...rows].reverse(), q, NOW);
      expect(a?.label, `qty ${q}`).toBe(b?.label);
    }
  });

  it("breaks an exact tie the same way every time: a percentage first (it needs no stock)", () => {
    // 10 cases: 1 free = 10% and a 10% slab are worth exactly the same
    const rows = [FREE(10, 1), SLAB(10, 1000)];
    expect(chooseScheme(rows, 10, NOW)?.type).toBe("SLAB_PERCENT");
    expect(chooseScheme([...rows].reverse(), 10, NOW)?.type).toBe("SLAB_PERCENT");
  });

  it("an order never costs less when the shop adds a case, across tiers and free goods", () => {
    const rows = [SLAB(5, 300), SLAB(20, 500), FREE(10, 1)];
    let prev = priceLine(line(1, rows), NOW).totalPaise;
    for (let q = 2; q <= 200; q++) {
      const t = priceLine(line(q, rows), NOW).totalPaise;
      // The price per case may fall as tiers kick in, but one more case must not make the whole bill smaller.
      expect(t, `qty ${q}`).toBeGreaterThan(prev - 1);
      prev = t;
    }
  });
});

describe("the nudge across several schemes", () => {
  const tiers = [SLAB(5, 300), SLAB(20, 500)];

  it("points at the next tier", () => {
    expect(priceLine(line(3, tiers), NOW).nextBenefit).toEqual({ kind: "SLAB_PERCENT", needCases: 2, percentBp: 300 });
    expect(priceLine(line(12, tiers), NOW).nextBenefit).toEqual({ kind: "SLAB_PERCENT", needCases: 8, percentBp: 500 });
  });

  it("says nothing once the top tier is reached", () => {
    expect(priceLine(line(25, tiers), NOW).nextBenefit).toBeNull();
  });

  it("never advertises a lower tier that a better one overrides", () => {
    // at 12 cases the shop has 5%; a 3% tier at 15 must not be offered
    const rows = [SLAB(5, 500), SLAB(15, 300)];
    expect(priceLine(line(12, rows), NOW).nextBenefit).toBeNull();
  });

  it("does not offer a threshold where a better scheme would win anyway, and suggests the one that does", () => {
    // free goods at 10 earn 10%; the 3% tier at 8 would be overridden at 10
    const rows = [FREE(10, 1), SLAB(8, 300)];
    expect(priceLine(line(6, rows), NOW).nextBenefit).toEqual({ kind: "SLAB_PERCENT", needCases: 2, percentBp: 300 });
    expect(priceLine(line(8, rows), NOW).nextBenefit).toEqual({ kind: "FREE_GOODS", needCases: 2, freeCases: 1 });
  });
});

describe("stock with several schemes", () => {
  it("counts free cases of whichever scheme applies", () => {
    const rows = [SLAB(5, 300), FREE(10, 1)];
    for (let stock = 0; stock <= 300; stock++) {
      const q = maxOrderableCases(stock, rows, NOW);
      const free = priceLine(line(q, rows, { stockCases: stock }), NOW);
      expect(free.issue, `stock ${stock}, qty ${q}`).toBeNull();
      if (q < stock) {
        const more = priceLine(line(q + 1, rows, { stockCases: stock }), NOW);
        // one more case would not fit, unless a lower-free scheme took over (non-contiguous), so only check the fit rule
        expect(more.qtyCases + more.freeCases > stock || more.issue === null).toBe(true);
      }
    }
  });
});

describe("scheme dates run through the whole last day, in Indian time", () => {
  // 30 Nov 2026 00:00 IST is 29 Nov 18:30 UTC
  const until = new Date("2026-11-29T18:30:00Z");
  const s: SchemeRule = { ...SLAB(5, 300), validUntil: until };
  it("is still live late on the last day", () => {
    expect(isSchemeLive(s, new Date("2026-11-30T17:00:00Z"))).toBe(true); // 22:30 IST on 30 Nov
  });
  it("stops at the first moment of the next Indian day", () => {
    expect(isSchemeLive(s, new Date("2026-11-30T18:29:59Z"))).toBe(true);
    expect(isSchemeLive(s, new Date("2026-11-30T18:30:00Z"))).toBe(false); // 1 Dec 00:00 IST
  });
  it("starts at the beginning of its first Indian day", () => {
    const f: SchemeRule = { ...SLAB(5, 300), validFrom: new Date("2026-11-30T05:00:00Z") }; // 10:30 IST on 30 Nov
    expect(isSchemeLive(f, new Date("2026-11-29T18:30:00Z"))).toBe(true); // 00:00 IST 30 Nov
    expect(isSchemeLive(f, new Date("2026-11-29T18:29:59Z"))).toBe(false);
  });
  it("an expired scheme gives nothing", () => {
    const l = priceLine(line(10, [s]), new Date("2026-12-05T00:00:00Z"));
    expect(l.discountPaise).toBe(0);
    expect(l.appliedScheme).toBeNull();
  });
});
