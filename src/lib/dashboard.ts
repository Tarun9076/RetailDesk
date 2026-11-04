// Which shops have gone quiet? Pure functions, so the rules are easy to test.

const TZ = "Asia/Kolkata";
export const QUIET_AFTER_DAYS = 14;
export const LOST_AFTER_DAYS = 30;

/** The calendar day in India as a UTC-midnight timestamp, for exact day arithmetic. */
function istDay(d: Date): number {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-")
    .map(Number);
  return Date.UTC(y, m - 1, day);
}

/**
 * Whole calendar days between two moments, in Indian time. An order placed at
 * 11 pm yesterday is 1 day ago at 8 am today, even though only 9 hours passed:
 * that is how a salesman would say it.
 */
export function daysSince(then: Date, now: Date): number {
  return Math.max(0, Math.round((istDay(now) - istDay(then)) / 86_400_000));
}

export type Bucket = "active" | "quiet" | "lost" | "never";

/** active: ordered within 13 days. quiet: 14 to 29. lost: 30 or more. */
export function bucketOf(days: number | null): Bucket {
  if (days === null) return "never";
  if (days >= LOST_AFTER_DAYS) return "lost";
  if (days >= QUIET_AFTER_DAYS) return "quiet";
  return "active";
}

export interface ShopActivity {
  id: string;
  shopName: string;
  ownerName: string;
  city: string;
  phone: string;
  lastOrderAt: Date | null; // latest order that was not cancelled
  orders90: number;
  value90Paise: number;
  availableCreditPaise: number;
}

export interface ShopRow extends ShopActivity {
  days: number | null;
  bucket: Bucket;
}

export function toRows(shops: ShopActivity[], now: Date): ShopRow[] {
  return shops.map((s) => {
    const days = s.lastOrderAt ? daysSince(s.lastOrderAt, now) : null;
    return { ...s, days, bucket: bucketOf(days) };
  });
}

/**
 * Shops with no order for at least `minDays`, longest quiet first. Shops that
 * have never ordered are included at the end: they are a different job
 * (onboarding), but the desk still wants to see them.
 */
export function dormant(rows: ShopRow[], minDays: number): ShopRow[] {
  return rows
    .filter((r) => r.days === null || r.days >= minDays)
    .sort((a, b) => {
      if (a.days === null && b.days === null) return a.shopName.localeCompare(b.shopName);
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return b.days - a.days || a.shopName.localeCompare(b.shopName);
    });
}

export function countByBucket(rows: ShopRow[]): Record<Bucket, number> {
  const counts: Record<Bucket, number> = { active: 0, quiet: 0, lost: 0, never: 0 };
  for (const r of rows) counts[r.bucket]++;
  return counts;
}
