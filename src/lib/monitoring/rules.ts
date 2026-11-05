// Rules for the error log: what counts as "the same problem", what is safe to keep, and when to raise
// an alert. Pure functions, so they are unit tested and the same everywhere.
import { createHash } from "node:crypto";

/** Removes things that must not sit in a log: email addresses, phone-like numbers, long digit runs, tokens. */
export function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [token]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[token]")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[database address]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]");
}

export interface ErrorInput {
  message: string;
  route?: string | null;
  method?: string | null;
  digest?: string | null;
  stack?: string | null;
}

/**
 * The same mistake on the same screen is one problem, however many times it happens: the key is the
 * message with numbers and ids flattened, plus the route and method. Ids such as cuids vary per request.
 */
export function fingerprintFor(e: ErrorInput): string {
  const flat = redact(e.message)
    .replace(/\b[a-z0-9]{20,}\b/gi, "<id>")
    .replace(/\d+/g, "#")
    .slice(0, 300);
  return createHash("sha1").update(`${e.method ?? ""}|${e.route ?? ""}|${flat}`).digest("hex").slice(0, 24);
}

export interface CleanError {
  message: string;
  route: string | null;
  method: string | null;
  digest: string | null;
  detail: string | null;
}

/** What is stored: redacted, and short enough that a flood of errors cannot fill the database. */
export function cleanError(e: ErrorInput): CleanError {
  return {
    message: redact(e.message || "Unknown error").slice(0, 400),
    route: e.route ? e.route.slice(0, 200) : null,
    method: e.method ? e.method.slice(0, 10) : null,
    digest: e.digest ? e.digest.slice(0, 60) : null,
    detail: e.stack ? redact(e.stack).slice(0, 2000) : null,
  };
}

const ALERT_AGAIN_AFTER_MS = 60 * 60_000;

/** A new problem alerts at once; one already alerted is repeated at most once an hour, and a resolved one alerts again if it comes back. */
export function shouldAlert(existing: { alertedAt: Date | null; resolved: boolean } | null, now: Date = new Date()): boolean {
  if (!existing) return true;
  if (existing.resolved) return true;
  if (!existing.alertedAt) return true;
  return now.getTime() - existing.alertedAt.getTime() >= ALERT_AGAIN_AFTER_MS;
}

/** The text sent to a chat webhook. Short, with the count, and no personal data. */
export function formatAlert(e: CleanError, count: number, appName = "RetailDesk"): string {
  const where = [e.method, e.route].filter(Boolean).join(" ");
  const times = count > 1 ? ` (happened ${count} times)` : "";
  return `${appName} server error${times}: ${e.message}${where ? `\nWhere: ${where}` : ""}${e.digest ? `\nReference: ${e.digest}` : ""}`;
}

/** Only an https address (or localhost, for testing) may receive alerts. */
export function webhookAllowed(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
