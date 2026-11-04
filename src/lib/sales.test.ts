import { describe, expect, it } from "vitest";
import {
  dayKey,
  fillDays,
  formatCompactPaise,
  istDayStart,
  niceScale,
  parseRange,
  periodFor,
  pctChange,
  shareOf,
  shortDay,
} from "./sales";

// 4 Nov 2026, 10:00 in India
const NOW = new Date("2026-11-04T04:30:00Z");

describe("Indian calendar days", () => {
  it("starts a day at midnight India time, not UTC", () => {
    expect(istDayStart(NOW).toISOString()).toBe("2026-11-03T18:30:00.000Z");
    expect(dayKey(NOW)).toBe("2026-11-04");
  });

  it("puts an evening UTC time on the next Indian day", () => {
    const late = new Date("2026-11-04T20:00:00Z"); // 1:30 am on 5 Nov in India
    expect(dayKey(late)).toBe("2026-11-05");
    expect(istDayStart(late).toISOString()).toBe("2026-11-04T18:30:00.000Z");
  });

  it("keeps the last minute of an Indian day on that day", () => {
    expect(dayKey(new Date("2026-11-04T18:29:59Z"))).toBe("2026-11-04");
    expect(dayKey(new Date("2026-11-04T18:30:00Z"))).toBe("2026-11-05");
  });
});

describe("periodFor", () => {
  it("'today' is one Indian day, compared with yesterday", () => {
    const p = periodFor("today", NOW);
    expect(p.days).toBe(1);
    expect(dayKey(p.from)).toBe("2026-11-04");
    expect(p.to.toISOString()).toBe("2026-11-04T18:30:00.000Z");
    expect(dayKey(p.prevFrom)).toBe("2026-11-03");
    expect(p.prevTo.getTime()).toBe(p.from.getTime());
  });

  it("'7 days' is today and the 6 days before", () => {
    const p = periodFor("7", NOW);
    expect(dayKey(p.from)).toBe("2026-10-29");
    expect((p.to.getTime() - p.from.getTime()) / 86_400_000).toBe(7);
  });

  it("the comparison period is the same length and ends where this one starts", () => {
    for (const k of ["today", "7", "30", "90"] as const) {
      const p = periodFor(k, NOW);
      expect(p.prevTo.getTime()).toBe(p.from.getTime());
      expect(p.from.getTime() - p.prevFrom.getTime()).toBe(p.to.getTime() - p.from.getTime());
    }
  });

  it("falls back to 30 days for anything unknown", () => {
    expect(parseRange(undefined)).toBe("30");
    expect(parseRange("1000")).toBe("30");
    expect(parseRange("7")).toBe("7");
  });
});

describe("fillDays", () => {
  it("returns every day in order, with zeros for days with no sales", () => {
    const from = periodFor("7", NOW).from;
    const out = fillDays([{ day: "2026-11-01", orders: 3, netPaise: 500_000 }], from, 7);
    expect(out.map((d) => d.day)).toEqual([
      "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
    ]);
    expect(out[3]).toEqual({ day: "2026-11-01", orders: 3, netPaise: 500_000 });
    expect(out.filter((d) => d.orders === 0)).toHaveLength(6);
  });

  it("drops rows that fall outside the period", () => {
    const from = periodFor("today", NOW).from;
    expect(fillDays([{ day: "2026-01-01", orders: 9, netPaise: 1 }], from, 1)).toEqual([
      { day: "2026-11-04", orders: 0, netPaise: 0 },
    ]);
  });
});

describe("pctChange and shareOf", () => {
  it("computes change as a fraction", () => {
    expect(pctChange(112, 100)).toBeCloseTo(0.12);
    expect(pctChange(50, 100)).toBeCloseTo(-0.5);
  });

  it("is null when there is nothing to compare with, never infinity", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
  });

  it("shares never divide by zero", () => {
    expect(shareOf(1, 4)).toBe(0.25);
    expect(shareOf(0, 0)).toBe(0);
  });
});

describe("formatCompactPaise", () => {
  it.each([
    [0, "₹0"],
    [99_00, "₹99"],
    [1_000_00, "₹1K"],
    [45_000_00, "₹45K"],
    [1_20_000_00, "₹1.2 L"],
    [2_40_000_00, "₹2.4 L"],
    [99_00_000_00, "₹99 L"],
    [1_00_00_000_00, "₹1 Cr"],
    [1_23_00_00_000_00, "₹123 Cr"],
    [-4_500_000, "-₹45K"],
  ])("%s paise -> %s", (paise, text) => {
    expect(formatCompactPaise(paise)).toBe(text);
  });
});

describe("niceScale", () => {
  it("rounds the top of the axis up to a clean number", () => {
    const s = niceScale(23_700_000); // ₹2.37 lakh
    expect(s.max).toBeGreaterThanOrEqual(23_700_000);
    expect(s.ticks[0]).toBe(0);
    expect(s.ticks.at(-1)).toBe(s.max);
    // every tick is evenly spaced
    const steps = new Set(s.ticks.slice(1).map((t, i) => t - s.ticks[i]));
    expect(steps.size).toBe(1);
  });

  it("uses round steps like 25, 50 or 100 thousand", () => {
    const s = niceScale(8_200_000, 4); // ₹82,000 -> ticks of 25,000
    expect(s.ticks).toEqual([0, 2_500_000, 5_000_000, 7_500_000, 10_000_000]);
  });

  it("gives an empty chart a sensible axis instead of NaN", () => {
    expect(niceScale(0)).toEqual({ max: 100_000, ticks: [0, 100_000] });
    expect(niceScale(Number.NaN).ticks.length).toBeGreaterThan(1);
  });

  it("never lets the top tick fall below the data", () => {
    for (const max of [1, 999, 12_345, 7_777_777, 987_654_321]) {
      expect(niceScale(max).max).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("shortDay", () => {
  it("formats a day without time zone effects", () => {
    expect(shortDay("2026-11-04")).toBe("4 Nov");
    expect(shortDay("2026-01-31")).toBe("31 Jan");
  });
});
