import { describe, expect, it } from "vitest";
import { checkBackup, reviveDates, TABLE_ORDER } from "../backup/dump";
import { cleanError, fingerprintFor, formatAlert, redact, shouldAlert, webhookAllowed } from "./rules";

describe("keeping personal data out of the error log", () => {
  it("removes emails, phone numbers, long numbers, tokens and database addresses", () => {
    const out = redact(
      "Unique constraint failed for priya@shop.in, phone +919876543210, order 1234567890123. Bearer abcdef123456789. postgresql://u:secret@host:5432/db",
    );
    expect(out).not.toMatch(/priya@|9876543210|1234567890123|abcdef123456789|secret/);
    expect(out).toContain("[email]");
    expect(out).toContain("[database address]");
  });
  it("removes a login token", () => {
    expect(redact("bad cookie eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiREVTSyIsInN1YiI6IjEifQ.abcdefghijklmnop")).toContain("[token]");
  });
  it("leaves ordinary words and short numbers alone", () => {
    expect(redact("Order RD-000105 failed at line 3")).toBe("Order RD-000105 failed at line 3");
  });
  it("keeps what it stores short", () => {
    const e = cleanError({ message: "x".repeat(5000), stack: "y".repeat(9000), route: "/r".repeat(500) });
    expect(e.message.length).toBeLessThanOrEqual(400);
    expect(e.detail!.length).toBeLessThanOrEqual(2000);
    expect(e.route!.length).toBeLessThanOrEqual(200);
  });
});

describe("what counts as the same problem", () => {
  const base = { method: "POST", route: "/api/orders" };
  it("is the same when only an id or a number differs", () => {
    const a = fingerprintFor({ ...base, message: "No order cmw2hlwxj00082kzbbi5z3gmi found, attempt 3" });
    const b = fingerprintFor({ ...base, message: "No order cmw2c9l2u0010rkzbl2ep8nxm found, attempt 17" });
    expect(a).toBe(b);
  });
  it("differs by message, by route and by method", () => {
    const a = fingerprintFor({ ...base, message: "Database unreachable" });
    expect(fingerprintFor({ ...base, message: "Something else" })).not.toBe(a);
    expect(fingerprintFor({ method: "POST", route: "/api/capture", message: "Database unreachable" })).not.toBe(a);
    expect(fingerprintFor({ method: "GET", route: "/api/orders", message: "Database unreachable" })).not.toBe(a);
  });
  it("is the same when only a phone number or email differs", () => {
    const a = fingerprintFor({ ...base, message: "Bad number +919876543210" });
    const b = fingerprintFor({ ...base, message: "Bad number +918765432109" });
    expect(a).toBe(b);
  });
});

describe("when to alert", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  it("alerts at once for a new problem", () => {
    expect(shouldAlert(null, now)).toBe(true);
  });
  it("does not repeat inside the hour, then does", () => {
    expect(shouldAlert({ alertedAt: ago(10), resolved: false }, now)).toBe(false);
    expect(shouldAlert({ alertedAt: ago(59), resolved: false }, now)).toBe(false);
    expect(shouldAlert({ alertedAt: ago(61), resolved: false }, now)).toBe(true);
  });
  it("alerts again if a problem that was dealt with comes back, or was never alerted", () => {
    expect(shouldAlert({ alertedAt: ago(1), resolved: true }, now)).toBe(true);
    expect(shouldAlert({ alertedAt: null, resolved: false }, now)).toBe(true);
  });
  it("writes a short message with the count and the place", () => {
    const text = formatAlert(cleanError({ message: "Database unreachable", route: "/api/orders", method: "POST", digest: "abc123" }), 4);
    expect(text).toBe("RetailDesk server error (happened 4 times): Database unreachable\nWhere: POST /api/orders\nReference: abc123");
    expect(formatAlert(cleanError({ message: "Boom" }), 1)).toBe("RetailDesk server error: Boom");
  });
  it("only sends to https addresses (or localhost, for testing)", () => {
    expect(webhookAllowed("https://hooks.slack.com/services/x")).toBe(true);
    expect(webhookAllowed("http://127.0.0.1:9911/alert")).toBe(true);
    expect(webhookAllowed("http://evil.example.com/x")).toBe(false);
    expect(webhookAllowed("not a url")).toBe(false);
    expect(webhookAllowed(undefined)).toBe(false);
  });
});

describe("backup file handling", () => {
  it("lists parents before children, and the two tables that point at each other in a workable order", () => {
    const at = (t: string) => TABLE_ORDER.indexOf(t as never);
    expect(at("Sku")).toBeLessThan(at("Scheme"));
    expect(at("Retailer")).toBeLessThan(at("Order"));
    expect(at("Order")).toBeLessThan(at("OrderLine"));
    expect(at("User")).toBeLessThan(at("Retailer")); // a shop refers to its salesman
  });
  it("turns saved dates back into dates, but leaves the stored JSON alone", () => {
    const row = reviveDates({ id: "x", createdAt: "2026-11-05T10:00:00.000Z", note: "2026-11-05T10:00:00.000Z is text here?", summary: { at: "2026-11-05T10:00:00.000Z" }, rows: "2026-11-05T10:00:00.000Z" });
    expect(row.createdAt).toBeInstanceOf(Date);
    expect((row.createdAt as Date).toISOString()).toBe("2026-11-05T10:00:00.000Z");
    expect(row.note).toBe("2026-11-05T10:00:00.000Z is text here?");
    expect(row.summary).toEqual({ at: "2026-11-05T10:00:00.000Z" });
    expect(row.rows).toBe("2026-11-05T10:00:00.000Z");
  });
  it("refuses a file that is not a RetailDesk backup, or has a table missing", () => {
    expect(() => checkBackup({ hello: 1 })).toThrow(/not a RetailDesk backup/);
    const tables = Object.fromEntries(TABLE_ORDER.map((t) => [t, []]));
    expect(() => checkBackup({ meta: { app: "RetailDesk", format: 1 }, tables })).not.toThrow();
    delete (tables as Record<string, unknown>).Order;
    expect(() => checkBackup({ meta: { app: "RetailDesk", format: 1 }, tables })).toThrow(/missing the Order table/);
  });
});
