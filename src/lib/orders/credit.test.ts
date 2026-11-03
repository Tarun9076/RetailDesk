import { describe, expect, it } from "vitest";
import { checkCredit } from "./credit";

const LIMIT = 5_000_000; // ₹50,000

describe("checkCredit", () => {
  it("allows an order within available credit", () => {
    const r = checkCredit(LIMIT, 3_000_000, 1_000_000);
    expect(r).toEqual({ hold: false, reason: null, availablePaise: 2_000_000 });
  });

  it("allows an order that exactly reaches the limit", () => {
    expect(checkCredit(LIMIT, 3_000_000, 2_000_000).hold).toBe(false);
  });

  it("holds an order that exceeds the limit and says by how much", () => {
    const r = checkCredit(LIMIT, 3_000_000, 2_500_000);
    expect(r.hold).toBe(true);
    expect(r.reason).toContain("5,000.00");
  });

  it("holds when the retailer is already over the limit", () => {
    expect(checkCredit(LIMIT, 6_000_000, 1).hold).toBe(true);
  });
});
