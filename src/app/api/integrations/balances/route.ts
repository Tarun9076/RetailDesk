import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { consume } from "@/lib/auth/rate-limit";
import { applyBalanceImport, previewBalances } from "@/lib/balances/service";
import { clientIp, json } from "@/lib/http";

const Body = z.object({
  rows: z
    .array(z.object({ ledger: z.string().trim().min(1).max(200), balance: z.union([z.string().max(40), z.number()]) }))
    .min(1)
    .max(5000),
  /** false (the default) only checks and reports; true also writes the amounts. */
  apply: z.boolean().default(false),
});

function tokenOk(header: string | null): boolean {
  const expected = process.env.BALANCES_API_TOKEN;
  if (!expected || expected.length < 24 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * For a script on the office PC that sends Tally's balances every night. It is switched off unless
 * BALANCES_API_TOKEN is set (24+ random characters). Without "apply": true it only reports what would change.
 */
export async function POST(req: Request) {
  if (!process.env.BALANCES_API_TOKEN) return json({ error: "disabled" }, 404);
  const gate = await consume(`balances-api:${clientIp(req)}`, 60, 3_600_000);
  if (!gate.allowed) return json({ error: "rate_limited", retryAfterSec: gate.retryAfterSec }, 429);
  if (!tokenOk(req.headers.get("authorization"))) return json({ error: "Unauthorized" }, 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: "Invalid request" }, 400);

  const cells = [["Ledger", "Balance"], ...parsed.data.rows.map((r) => [r.ledger, r.balance])];
  const preview = await previewBalances(cells, { source: "API", fileName: null, byName: "Tally sync" });
  if (!preview.ok) return json({ error: "no_match", message: preview.message }, 422);

  if (!parsed.data.apply) return json({ applied: false, importId: preview.importId, summary: preview.summary });
  const done = await applyBalanceImport(preview.importId, "Tally sync");
  if (!done.ok) return json({ error: done.reason }, 409);
  return json({ applied: true, importId: preview.importId, summary: preview.summary, result: done });
}
