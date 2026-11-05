import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { createSession } from "@/lib/auth/session";
import { issuedAfter } from "@/lib/auth/session-rules";
import { json, parseBody } from "@/lib/http";
import { changeOwnPassword } from "@/lib/staff/service";

const Body = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(1).max(200),
});

/**
 * Choose a new password. This is the one desk route that also accepts an account
 * still on a temporary password, which is why it reads the session directly.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const r = await changeOwnPassword(user, parsed.data.current, parsed.data.next);
  if (!r.ok) {
    if (r.reason === "rate_limited") return json({ error: "rate_limited", retryAfterSec: r.retryAfterSec }, 429);
    if (r.reason === "weak") return json({ error: "weak", message: r.message }, 422);
    return json({ error: "wrong_current" }, 401);
  }
  // Every older login was just signed out. Give this browser a fresh one so the person stays in.
  await createSession({ sub: user.id, role: "DESK", retailerId: null }, issuedAfter(r.cutoff));
  return json({ ok: true, redirect: "/desk" });
}
