import { z } from "zod";
import { normalisePhone } from "@/lib/auth/phone";
import { requestOtp } from "@/lib/auth/otp";
import { clientIp, json, parseBody } from "@/lib/http";

const Body = z.object({ phone: z.string().min(10).max(20) });

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return json({ error: "invalid_phone" }, 400);

  const result = await requestOtp(phone, clientIp(req));
  switch (result.status) {
    case "sent":
      return json({ ok: true });
    case "cooldown":
    case "rate_limited":
      return json({ error: result.status, retryAfterSec: result.retryAfterSec }, 429);
    case "send_failed":
      return json({ error: "send_failed" }, 502);
  }
}
