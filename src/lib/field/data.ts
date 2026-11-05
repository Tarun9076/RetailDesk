import "server-only";
import { db } from "@/lib/db";
import { liveSchemes } from "@/lib/catalogue";
import { safeImageUrl } from "@/lib/product-look";
import type { FieldSnapshot } from "./types";

/**
 * Everything one salesman is allowed to carry: the product list, and for each
 * shop assigned to them its credit and its own prices. Another salesman's
 * shops are never included. Prices are sent once per product, with only each
 * shop's differences beside it, so the download stays small with 100 shops.
 */
export async function loadFieldSnapshot(salesmanId: string, now: Date = new Date()): Promise<FieldSnapshot> {
  const [salesman, skus, shops, recent] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: salesmanId }, select: { id: true, name: true } }),
    db.sku.findMany({
      where: { active: true },
      include: { schemes: { where: { active: true } } },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
    }),
    db.retailer.findMany({
      where: { salesmanId, active: true },
      include: { prices: true },
      orderBy: { shopName: "asc" },
    }),
    db.order.findMany({
      where: { placedById: salesmanId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { retailer: { select: { shopName: true } } },
    }),
  ]);

  const shopIds = shops.map((s) => s.id);
  const [open, last] = await Promise.all([
    db.order.groupBy({
      by: ["retailerId"],
      where: { retailerId: { in: shopIds }, status: { in: ["PLACED", "CONFIRMED"] } },
      _sum: { totalPaise: true },
    }),
    db.order.groupBy({
      by: ["retailerId"],
      where: { retailerId: { in: shopIds }, status: { not: "CANCELLED" } },
      _max: { createdAt: true },
    }),
  ]);
  const openBy = new Map(open.map((r) => [r.retailerId, r._sum.totalPaise ?? 0]));
  const lastBy = new Map(last.map((r) => [r.retailerId, r._max.createdAt]));

  return {
    syncedAt: now.toISOString(),
    salesman,
    skus: skus.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      nameHi: s.nameHi,
      brand: s.brand,
      piecesPerCase: s.piecesPerCase,
      pricePaise: s.pricePaise,
      gstRateBp: s.gstRateBp,
      stockCases: s.stockCases,
      imageUrl: safeImageUrl(s.imageUrl),
      schemes: liveSchemes(s.schemes, now),
    })),
    shops: shops.map((s) => ({
      id: s.id,
      shopName: s.shopName,
      ownerName: s.name,
      city: s.city,
      phone: s.phone,
      creditLimitPaise: s.creditLimitPaise,
      outstandingPaise: s.outstandingPaise,
      openOrdersPaise: openBy.get(s.id) ?? 0,
      lastOrderAt: lastBy.get(s.id)?.toISOString() ?? null,
      overrides: Object.fromEntries(s.prices.map((p) => [p.skuId, p.pricePaise])),
    })),
    recentOrders: recent.map((o) => ({
      id: o.id,
      number: o.number,
      shopName: o.retailer.shopName,
      totalPaise: o.totalPaise,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
