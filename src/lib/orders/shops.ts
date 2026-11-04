import "server-only";
import { db } from "@/lib/db";
import type { ShopActivity } from "@/lib/dashboard";

/**
 * One row per shop with its latest order and 90-day totals. Three grouped
 * queries instead of one per shop, so it stays fast with 1,800 shops.
 * A cancelled order does not count as the shop having ordered.
 */
export async function loadShopActivity(now: Date = new Date()): Promise<ShopActivity[]> {
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [shops, last, recent, open] = await Promise.all([
    db.retailer.findMany({ orderBy: { shopName: "asc" } }),
    db.order.groupBy({
      by: ["retailerId"],
      where: { status: { not: "CANCELLED" } },
      _max: { createdAt: true },
    }),
    db.order.groupBy({
      by: ["retailerId"],
      where: { status: { not: "CANCELLED" }, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalPaise: true },
    }),
    db.order.groupBy({
      by: ["retailerId"],
      where: { status: { in: ["PLACED", "CONFIRMED"] } },
      _sum: { totalPaise: true },
    }),
  ]);

  const lastBy = new Map(last.map((r) => [r.retailerId, r._max.createdAt]));
  const recentBy = new Map(recent.map((r) => [r.retailerId, r]));
  const openBy = new Map(open.map((r) => [r.retailerId, r._sum.totalPaise ?? 0]));

  return shops.map((s) => ({
    id: s.id,
    shopName: s.shopName,
    ownerName: s.name,
    city: s.city,
    phone: s.phone,
    lastOrderAt: lastBy.get(s.id) ?? null,
    orders90: recentBy.get(s.id)?._count._all ?? 0,
    value90Paise: recentBy.get(s.id)?._sum.totalPaise ?? 0,
    availableCreditPaise: s.creditLimitPaise - s.outstandingPaise - (openBy.get(s.id) ?? 0),
  }));
}
