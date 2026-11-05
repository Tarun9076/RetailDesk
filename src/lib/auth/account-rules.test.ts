import { describe, expect, it } from "vitest";
import { generateTempPassword } from "./password";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "./password-rules";
import { isSessionRevoked, issuedAfter, revocationCutoff } from "./session-rules";

describe("password rules", () => {
  it("needs ten characters", () => {
    expect(validateNewPassword("abc12345")).toMatch(/at least 10/);
    expect(validateNewPassword("abcde12345")).toBeNull();
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });
  it("needs letters and numbers, unless it is long", () => {
    expect(validateNewPassword("onlylettersss")).toMatch(/letters and numbers/);
    expect(validateNewPassword("1234567890123")).toMatch(/letters and numbers/);
    expect(validateNewPassword("a-long-passphrase-with-words")).toBeNull();
  });
  it("refuses very common passwords, and one character repeated", () => {
    expect(validateNewPassword("Password123")).toMatch(/too common/);
    expect(validateNewPassword("RetailDesk123")).toMatch(/too common/);
    expect(validateNewPassword("aaaaaaaaaaaa")).not.toBeNull();
  });
  it("refuses the email, the name, and keeping the old password", () => {
    expect(validateNewPassword("priya.sharma2026", { email: "priya.sharma@shop.in" })).toMatch(/email/);
    expect(validateNewPassword("Priyanka1234", { name: "Priyanka Sharma" })).toBeNull(); // not exactly the name
    expect(validateNewPassword("sameold1234x", { current: "sameold1234x" })).toMatch(/different/);
  });
  it("stops at 128 characters", () => {
    expect(validateNewPassword("a1".repeat(65))).toMatch(/at most 128/);
  });
});

describe("temporary passwords", () => {
  it("are 12 characters, easy to read out, and always acceptable", () => {
    for (let i = 0; i < 300; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(12);
      expect(p).not.toMatch(/[0OIl1]/);
      expect(validateNewPassword(p)).toBeNull();
    }
  });
  it("are not repeated", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTempPassword()));
    expect(seen.size).toBe(500);
  });
});

describe("signing people out when a password changes", () => {
  const cutoff = new Date("2026-11-05T10:00:00.700Z");
  const ms = (iso: string) => new Date(iso).getTime();
  it("keeps everyone signed in when nothing was revoked", () => {
    expect(isSessionRevoked(null, ms("2026-11-01T00:00:00Z"))).toBe(false);
  });
  it("ends a login issued before the cut-off, even by a fraction of a second", () => {
    expect(isSessionRevoked(cutoff, ms("2026-11-05T09:59:59Z"))).toBe(true);
    expect(isSessionRevoked(cutoff, ms("2026-11-05T10:00:00.699Z"))).toBe(true); // the same second, but earlier
    expect(isSessionRevoked(cutoff, undefined)).toBe(true);
  });
  it("keeps a login issued at or after the cut-off", () => {
    expect(isSessionRevoked(cutoff, ms("2026-11-05T10:00:00.700Z"))).toBe(false);
    expect(isSessionRevoked(cutoff, ms("2026-11-05T10:00:00.900Z"))).toBe(false);
    expect(isSessionRevoked(cutoff, ms("2026-11-05T12:00:00Z"))).toBe(false);
  });
  it("keeps the person who changed their own password signed in, even if this server's clock is a little behind", () => {
    const c = revocationCutoff(new Date("2026-11-05T10:00:00.700Z"));
    const slowClock = new Date("2026-11-05T10:00:00.650Z"); // 50 ms behind the clock that set the cut-off
    expect(isSessionRevoked(c, issuedAfter(c, slowClock).getTime())).toBe(false);
    expect(isSessionRevoked(c, slowClock.getTime())).toBe(true); // without the fix they would have been signed out
  });
});
