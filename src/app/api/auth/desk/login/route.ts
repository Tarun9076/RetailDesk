import { z } from "zod";
import { loginDesk } from "@/lib/auth/desk";
import { createSession } from "@/lib/auth/session";
import { clientIp, json, parseBody } from "@/lib/http";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const result = await loginDesk(parsed.data.email, parsed.data.password, clientIp(req));
  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return json({ error: "rate_limited", retryAfterSec: result.retryAfterSec }, 429);
    }
    return json({ error: "invalid_credentials" }, 401);
  }

  await createSession({ sub: result.userId, role: "DESK", retailerId: null });
  // A temporary password only opens the "choose your own password" screen.
  return json({ ok: true, redirect: result.mustChangePassword ? "/desk/account?first=1" : "/desk" });
}
