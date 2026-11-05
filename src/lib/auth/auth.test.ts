import { describe, expect, it } from "vitest";
import { normalisePhone } from "./phone";
import {
  OTP_MAX_ATTEMPTS,
  evaluateOtp,
  generateCode,
  hashCode,
  type ChallengeState,
} from "./otp-core";
import { signSession, verifySession } from "./session-token";

const SECRET = "x".repeat(40);
const NOW = new Date("2026-11-04T10:00:00Z");

describe("normalisePhone", () => {
  it.each([
    ["9000000001", "+919000000001"],
    ["09000000001", "+919000000001"],
    ["+91 90000 00001", "+919000000001"],
    ["91-9000000001", "+919000000001"],
    ["(900) 000-0001", "+919000000001"],
  ])("accepts %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "5000000001", "90000000011", "abcdefghij", "+1 415 555 2671"])(
    "rejects %s",
    (input) => {
      expect(normalisePhone(input)).toBeNull();
    },
  );
});

describe("OTP", () => {
  const phone = "+919000000001";
  const challenge = (over: Partial<ChallengeState> = {}): ChallengeState => ({
    codeHash: hashCode(SECRET, phone, "123456"),
    expiresAt: new Date(NOW.getTime() + 60_000),
    attempts: 0,
    consumedAt: null,
    ...over,
  });
  const submit = (code: string) => hashCode(SECRET, phone, code);

  it("generates 6-digit numeric codes", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("binds the hash to the phone number and secret", () => {
    const base = hashCode(SECRET, phone, "123456");
    expect(hashCode(SECRET, "+919000000002", "123456")).not.toBe(base);
    expect(hashCode("y".repeat(40), phone, "123456")).not.toBe(base);
  });

  it("accepts the right code", () => {
    expect(evaluateOtp(challenge(), submit("123456"), NOW)).toBe("ok");
  });

  it("rejects a wrong code", () => {
    expect(evaluateOtp(challenge(), submit("000000"), NOW)).toBe("wrong");
  });

  it("rejects an expired code even if correct", () => {
    const expired = challenge({ expiresAt: new Date(NOW.getTime() - 1) });
    expect(evaluateOtp(expired, submit("123456"), NOW)).toBe("expired");
  });

  it("rejects a code that was already used", () => {
    expect(evaluateOtp(challenge({ consumedAt: NOW }), submit("123456"), NOW)).toBe("used");
  });

  it("locks after too many attempts, even for the right code", () => {
    const locked = challenge({ attempts: OTP_MAX_ATTEMPTS });
    expect(evaluateOtp(locked, submit("123456"), NOW)).toBe("locked");
  });
});

describe("session token", () => {
  const retailer = { sub: "u1", role: "RETAILER" as const, retailerId: "r1" };

  it("round-trips a payload", async () => {
    const token = await signSession(retailer, SECRET, NOW);
    const back = await verifySession(token, SECRET, NOW);
    expect(back).toEqual({ ...retailer, issuedAtMs: NOW.getTime() });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession(retailer, "y".repeat(40), NOW);
    expect(await verifySession(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signSession(retailer, SECRET, NOW);
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "u1", role: "DESK", retailerId: null, exp: 9999999999 }),
    ).toString("base64url");
    expect(await verifySession(`${h}.${forged}.${s}`, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token; desk sessions are shorter than retailer ones", async () => {
    const desk = { sub: "d1", role: "DESK" as const, retailerId: null };
    const dToken = await signSession(desk, SECRET, NOW);
    const rToken = await signSession(retailer, SECRET, NOW);
    const in13h = new Date(NOW.getTime() + 13 * 3600_000);
    expect(await verifySession(dToken, SECRET, in13h)).toBeNull();
    expect(await verifySession(rToken, SECRET, in13h)).not.toBeNull();
  });

  it("refuses to sign with a short secret", async () => {
    await expect(signSession(retailer, "short", NOW)).rejects.toThrow();
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not.a.jwt", SECRET, NOW)).toBeNull();
  });
});
