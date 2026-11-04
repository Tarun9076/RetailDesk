import { describe, expect, it } from "vitest";
import {
  bucketOf,
  countByBucket,
  daysSince,
  dormant,
  toRows,
  type ShopActivity,
} from "./dashboard";

// 4 Nov 2026, 10:00 in India
const NOW = new Date("2026-11-04T04:30:00Z");
const ago = (days: number, hoursOffset = 0) => new Date(NOW.getTime() - days * 86_400_000 - hoursOffset * 3_600_000);

const shop = (name: string, lastOrderAt: Date | null, over: Partial<ShopActivity> = {}): ShopActivity => ({
  id: name,
  shopName: name,
  ownerName: "Owner",
  city: "Jabalpur",
  phone: "+919000000000",
  lastOrderAt,
  orders90: 0,
  value90Paise: 0,
  availableCreditPaise: 0,
  ...over,
});

describe("daysSince", () => {
  it("counts whole calendar days in Indian time", () => {
    expect(daysSince(ago(0), NOW)).toBe(0);
    expect(daysSince(ago(1), NOW)).toBe(1);
    expect(daysSince(ago(14), NOW)).toBe(14);
    expect(daysSince(ago(19), NOW)).toBe(19);
  });

  it("uses the calendar day, not 24-hour blocks", () => {
    // 11 pm IST yesterday (17:30 UTC) is "1 day ago" at 10 am today, though only 11 hours passed
    expect(daysSince(new Date("2026-11-03T17:30:00Z"), NOW)).toBe(1);
    // 12:05 am IST today is still "today"
    expect(daysSince(new Date("2026-11-03T18:35:00Z"), NOW)).toBe(0);
  });

  it("does not let UTC midnight shift the day for an evening order", () => {
    // 9 pm IST on 3 Nov is 15:30 UTC on 3 Nov; viewed at 1 am IST on 5 Nov (19:30 UTC 4 Nov)
    const lateNow = new Date("2026-11-04T19:30:00Z");
    expect(daysSince(new Date("2026-11-03T15:30:00Z"), lateNow)).toBe(2);
  });

  it("never goes negative for a timestamp slightly in the future", () => {
    expect(daysSince(new Date(NOW.getTime() + 60_000), NOW)).toBe(0);
  });
});

describe("bucketOf", () => {
  it.each([
    [0, "active"],
    [13, "active"],
    [14, "quiet"], // exactly 14 days counts as "no order in 14 days"
    [29, "quiet"],
    [30, "lost"],
    [200, "lost"],
    [null, "never"],
  ] as const)("%s days -> %s", (days, bucket) => {
    expect(bucketOf(days)).toBe(bucket);
  });
});

describe("dormant", () => {
  const rows = toRows(
    [
      shop("Fresh", ago(2)),
      shop("Edge", ago(14)),
      shop("Quiet", ago(19)),
      shop("Lost", ago(27 + 5)),
      shop("Ghost B", null),
      shop("Ghost A", null),
      shop("Thirteen", ago(13)),
    ],
    NOW,
  );

  it("keeps shops quiet for 14 or more days, longest first, never-ordered last", () => {
    expect(dormant(rows, 14).map((r) => r.shopName)).toEqual(["Lost", "Quiet", "Edge", "Ghost A", "Ghost B"]);
  });

  it("can use a stricter threshold", () => {
    expect(dormant(rows, 30).map((r) => r.shopName)).toEqual(["Lost", "Ghost A", "Ghost B"]);
  });

  it("with a zero threshold lists everyone", () => {
    expect(dormant(rows, 0)).toHaveLength(7);
  });

  it("breaks ties by shop name so the list does not jump around", () => {
    const tie = toRows([shop("Zed", ago(20)), shop("Alpha", ago(20))], NOW);
    expect(dormant(tie, 14).map((r) => r.shopName)).toEqual(["Alpha", "Zed"]);
  });
});

describe("countByBucket", () => {
  it("counts each group", () => {
    const rows = toRows([shop("a", ago(1)), shop("b", ago(15)), shop("c", ago(40)), shop("d", null), shop("e", ago(3))], NOW);
    expect(countByBucket(rows)).toEqual({ active: 2, quiet: 1, lost: 1, never: 1 });
  });
});
