import { z } from "zod";
import { normalisePhone } from "@/lib/auth/phone";
import { verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { clientIp, json, parseBody } from "@/lib/http";

const Body = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return json({ error: "invalid_code" }, 400);

  const result = await verifyOtp(phone, parsed.data.code, clientIp(req));
  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return json({ error: "rate_limited", retryAfterSec: result.retryAfterSec }, 429);
    }
    return json({ error: "invalid_code" }, 401);
  }

  await createSession({ sub: result.userId, role: "RETAILER", retailerId: result.retailerId });
  return json({ ok: true, redirect: "/catalogue" });
}
