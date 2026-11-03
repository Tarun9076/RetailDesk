import { db } from "@/lib/db";

export interface LimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/** Number of recorded hits for `key` in the last `windowMs`. */
async function recent(key: string, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const [count, oldest] = await Promise.all([
    db.rateLimitHit.count({ where: { key, createdAt: { gte: since } } }),
    db.rateLimitHit.findFirst({
      where: { key, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const retryAfterSec = oldest
    ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + windowMs - Date.now()) / 1000))
    : 0;
  return { count, retryAfterSec };
}

/** Sliding window: records a hit and allows it only while under `limit`. */
export async function consume(key: string, limit: number, windowMs: number): Promise<LimitResult> {
  const { count, retryAfterSec } = await recent(key, windowMs);
  if (count >= limit) return { allowed: false, retryAfterSec };
  await db.rateLimitHit.create({ data: { key } });
  return { allowed: true, retryAfterSec: 0 };
}

/** Checks without recording (used when only failures should count). */
export async function isBlocked(key: string, limit: number, windowMs: number): Promise<LimitResult> {
  const { count, retryAfterSec } = await recent(key, windowMs);
  return { allowed: count < limit, retryAfterSec: count < limit ? 0 : retryAfterSec };
}

export async function recordHit(key: string) {
  await db.rateLimitHit.create({ data: { key } });
}

export async function clearHits(key: string) {
  await db.rateLimitHit.deleteMany({ where: { key } });
}
