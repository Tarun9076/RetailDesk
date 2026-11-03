import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** CSRF defence for cookie-authenticated POSTs: the Origin must match our own host. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Parses and validates a JSON body; returns a ready 400/403 response on failure. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  if (!isSameOrigin(req)) return { error: json({ error: "Forbidden" }, 403) };
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: json({ error: "Invalid request" }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: json({ error: "Invalid request" }, 400) };
  return { data: parsed.data };
}
