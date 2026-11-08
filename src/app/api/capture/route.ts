import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { consume } from "@/lib/auth/rate-limit";
import { CaptureAiError } from "@/lib/capture/gemini";
import { MAX_PHOTO_BYTES, sniffImage } from "@/lib/capture/photo";
import { createCapture, createPhotoCapture } from "@/lib/capture/service";
import { isSameOrigin, json, parseBody } from "@/lib/http";

// Reading a handwritten list takes the AI longer than reading typed text.
export const maxDuration = 30;

const Body = z.object({ text: z.string().trim().min(2).max(1500) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  // The retailer comes from the session, never from the request.
  if (!user || user.role !== "RETAILER" || !user.retailerId) return json({ error: "Unauthorized" }, 401);

  if (req.headers.get("content-type")?.startsWith("multipart/form-data")) return photo(req, user.retailerId);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  // Each read may call a paid AI service, so it is limited per shop.
  const limit = await consume(`capture:${user.retailerId}`, 15, 10 * 60_000);
  if (!limit.allowed) return json({ error: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429);

  const result = await createCapture(user.retailerId, parsed.data.text);
  return json(result);
}

/** A photo of a list. Checked by what the bytes are, not by what the browser says they are. */
async function photo(req: Request, retailerId: string) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);

  // Photos cost more to read than text, so they have their own, tighter limit.
  const limit = await consume(`capture-photo:${retailerId}`, 8, 10 * 60_000);
  if (!limit.allowed) return json({ error: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("photo");
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!(file instanceof File)) return json({ error: "Invalid request" }, 400);
  if (file.size > MAX_PHOTO_BYTES) return json({ error: "photo_too_big" }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImage(bytes);
  if (!mimeType) return json({ error: "photo_type" }, 415);

  try {
    return json(await createPhotoCapture(retailerId, { mimeType, data: Buffer.from(bytes).toString("base64") }));
  } catch (e) {
    // The AI is down, out of quota or timed out. Only the kind of failure is logged, never the picture.
    console.warn("Photo reading unavailable:", e instanceof CaptureAiError ? e.code : "error");
    return json({ error: "photo_unreadable" }, 503);
  }
}
