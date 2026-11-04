import { describe, expect, it } from "vitest";
import { allowedActions, nextStatus, type DeskAction, type OrderStatusName } from "./transitions";

describe("order transitions", () => {
  it("confirms a normal order and releases a held one", () => {
    expect(nextStatus("PLACED", "CONFIRM")).toBe("CONFIRMED");
    expect(nextStatus("ON_HOLD", "RELEASE")).toBe("CONFIRMED");
  });

  it("does not let a held order be confirmed without an explicit release", () => {
    expect(nextStatus("ON_HOLD", "CONFIRM")).toBeNull();
  });

  it("does not let a normal order use the release action", () => {
    expect(nextStatus("PLACED", "RELEASE")).toBeNull();
  });

  it("can cancel any open order", () => {
    for (const s of ["PLACED", "ON_HOLD", "CONFIRMED"] as OrderStatusName[]) {
      expect(nextStatus(s, "CANCEL")).toBe("CANCELLED");
    }
  });

  it("treats exported and cancelled orders as final", () => {
    for (const s of ["EXPORTED", "CANCELLED"] as OrderStatusName[]) {
      for (const a of ["CONFIRM", "RELEASE", "CANCEL"] as DeskAction[]) {
        expect(nextStatus(s, a)).toBeNull();
      }
      expect(allowedActions(s)).toEqual([]);
    }
  });

  it("lists the actions each state offers", () => {
    expect(allowedActions("PLACED")).toEqual(["CONFIRM", "CANCEL"]);
    expect(allowedActions("ON_HOLD")).toEqual(["RELEASE", "CANCEL"]);
    expect(allowedActions("CONFIRMED")).toEqual(["CANCEL"]);
  });
});
