import { describe, expect, it } from "vitest";
import { priceOrder } from "@/lib/pricing/engine";
import {
  describeChange,
  isStale,
  isUnsent,
  newQueuedOrder,
  pruneSent,
  unsentPaiseFor,
  type QueuedOrder,
} from "./queue";
import { catalogueForShop, creditLeftPaise, type FieldShop, type FieldSku } from "./types";

const biscuit: FieldSku = {
  id: "b", code: "B", name: "Biscuit", nameHi: null, brand: "A", piecesPerCase: 96, pricePaise: 810, gstRateBp: 1200, stockCases: 340,
  schemes: [{ type: "FREE_GOODS", buyQty: 10, freeQty: 1, label: "Buy 10 get 1" }],
};
const shop = (over: Partial<FieldShop> = {}): FieldShop => ({
  id: "s1", shopName: "Gupta", ownerName: "R", city: "J", phone: "+91", creditLimitPaise: 150_000_00, outstandingPaise: 30_000_00,
  openOrdersPaise: 10_000_00, lastOrderAt: null, overrides: {}, ...over,
});

function order(over: Partial<QueuedOrder> = {}, qty = 10): QueuedOrder {
  const items = catalogueForShop([biscuit], shop());
  const priced = priceOrder(
    items.map((i) => ({
      skuId: i.id, qtyCases: qty, unitPricePaise: i.unitPricePaise, piecesPerCase: i.piecesPerCase,
      gstRateBp: i.gstRateBp, stockCases: i.stockCases, scheme: i.schemes,
    })),
  );
  return {
    ...newQueuedOrder({
      id: "o1", userId: "u1", shopId: "s1", shopName: "Gupta",
      lines: [{ skuId: "b", name: "Biscuit", qtyCases: qty }], note: " hello ", priced, now: new Date("2026-11-05T05:00:00Z"),
    }),
    ...over,
  };
}

describe("the shop's catalogue, built on the phone", () => {
  it("uses the shop's own price where one is set, else the dealer price", () => {
    expect(catalogueForShop([biscuit], shop())[0].unitPricePaise).toBe(810);
    const own = catalogueForShop([biscuit], shop({ overrides: { b: 790 } }))[0];
    expect(own.unitPricePaise).toBe(790);
    expect(own.casePricePaise).toBe(790 * 96);
  });

  it("prices the same as the server would: 10 biscuit cases, 1 free, Rs 8,709.12", () => {
    expect(order().expected.totalPaise).toBe(870_912);
    expect(order().expected.lines[0].freeCases).toBe(1);
  });

  it("credit left counts open orders and orders still on the phone", () => {
    expect(creditLeftPaise(shop())).toBe(110_000_00);
    expect(creditLeftPaise(shop(), 5_000_00)).toBe(105_000_00);
  });
});

describe("a queued order", () => {
  it("starts unsent, trimmed, and keyed by its own id", () => {
    const o = order();
    expect(o.status).toBe("pending");
    expect(o.note).toBe("hello");
    expect(o.id).toBe("o1");
    expect(isUnsent(o)).toBe(true);
  });

  it("only unsent orders for that shop use up its credit", () => {
    const q = [order(), order({ id: "o2", shopId: "s2" }), order({ id: "o3", status: "sent" })];
    expect(unsentPaiseFor(q, "s1")).toBe(870_912);
    expect(unsentPaiseFor(q, "s2")).toBe(870_912);
    expect(unsentPaiseFor(q, "s9")).toBe(0);
  });
});

describe("what changed while the phone was offline", () => {
  const sentWith = (totalPaise: number, free: number): QueuedOrder =>
    order({
      status: "sent",
      result: {
        number: "RD-1", orderStatus: "PLACED", totalPaise, sentAt: "2026-11-05T06:00:00Z",
        lines: [{ skuId: "b", qtyCases: 10, freeCases: free, totalPaise }],
      },
    });

  it("reports nothing when the server agrees with the phone", () => {
    expect(describeChange(sentWith(870_912, 1)).changed).toBe(false);
  });

  it("reports a price move, with the difference", () => {
    const c = describeChange(sentWith(880_000, 1));
    expect(c.changed).toBe(true);
    expect(c.totalDeltaPaise).toBe(880_000 - 870_912);
    expect(c.lines[0]).toMatchObject({ name: "Biscuit", expectedPaise: 870_912, actualPaise: 880_000 });
  });

  it("reports a scheme that stopped, even if the total happens to match", () => {
    const c = describeChange(sentWith(870_912, 0));
    expect(c.changed).toBe(true);
    expect(c.totalDeltaPaise).toBe(0);
    expect(c.lines[0]).toMatchObject({ expectedFree: 1, actualFree: 0 });
  });

  it("has nothing to say about an order that has not been sent", () => {
    expect(describeChange(order()).changed).toBe(false);
  });
});

describe("keeping the phone tidy", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const sentAt = (iso: string) => order({ id: iso, status: "sent", result: { number: "x", orderStatus: "PLACED", totalPaise: 1, lines: [], sentAt: iso } });

  it("drops sent orders after three days and never drops unsent ones", () => {
    const q = [sentAt("2026-11-09T00:00:00Z"), sentAt("2026-11-05T00:00:00Z"), order({ id: "old", createdAt: "2026-10-01T00:00:00Z" })];
    const kept = pruneSent(q, now).map((o) => o.id);
    expect(kept).toContain("2026-11-09T00:00:00Z");
    expect(kept).not.toContain("2026-11-05T00:00:00Z");
    expect(kept).toContain("old");
  });

  it("warns when prices are more than a day old", () => {
    expect(isStale("2026-11-09T01:00:00Z", now)).toBe(false);
    expect(isStale("2026-11-08T23:00:00Z", now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
  });
});
