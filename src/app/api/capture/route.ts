import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { consume } from "@/lib/auth/rate-limit";
import { createCapture } from "@/lib/capture/service";
import { json, parseBody } from "@/lib/http";

const Body = z.object({ text: z.string().trim().min(2).max(1500) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  // The retailer comes from the session, never from the request.
  if (!user || user.role !== "RETAILER" || !user.retailerId) return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  // Each read may call a paid AI service, so it is limited per shop.
  const limit = await consume(`capture:${user.retailerId}`, 15, 10 * 60_000);
  if (!limit.allowed) return json({ error: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429);

  const result = await createCapture(user.retailerId, parsed.data.text);
  return json(result);
}
