import { db } from "@/lib/db";
import { cleanError, fingerprintFor, formatAlert, shouldAlert, webhookAllowed, type ErrorInput } from "./rules";

const KEEP_ROWS = 300;

async function sendAlert(text: string): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!webhookAllowed(url)) return false;
  try {
    // "text" is what Slack-style hooks read, "content" is what Discord reads; each ignores the other.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Writes a server error to the log (grouped by what went wrong) and raises an alert when it is new or
 * has come back. It must never throw: a problem in the error log must not make a failing request worse.
 */
export async function recordServerError(input: ErrorInput): Promise<void> {
  try {
    const e = cleanError(input);
    const fingerprint = fingerprintFor(input);
    const now = new Date();

    const existing = await db.errorLog.findUnique({ where: { fingerprint }, select: { alertedAt: true, resolved: true } });
    const alert = shouldAlert(existing, now);
    const row = await db.errorLog.upsert({
      where: { fingerprint },
      create: { fingerprint, message: e.message, route: e.route, method: e.method, digest: e.digest, detail: e.detail, firstSeenAt: now, lastSeenAt: now },
      update: { count: { increment: 1 }, lastSeenAt: now, resolved: false, digest: e.digest ?? undefined, detail: e.detail ?? undefined },
      select: { id: true, count: true },
    });

    if (alert && (await sendAlert(formatAlert(e, row.count)))) {
      await db.errorLog.update({ where: { id: row.id }, data: { alertedAt: now } });
    }

    // Keep the table small: drop the oldest beyond a fixed number.
    if (row.count === 1) {
      const old = await db.errorLog.findMany({ orderBy: { lastSeenAt: "desc" }, skip: KEEP_ROWS, select: { id: true } });
      if (old.length) await db.errorLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  } catch (err) {
    console.error("could not record an error", err instanceof Error ? err.message : err);
  }
}
