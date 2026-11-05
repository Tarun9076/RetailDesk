// Client-safe: shared by the server (what it sends) and the phone (what it stores).
import type { CatalogueItem } from "@/lib/catalogue-types";
import type { SchemeRule } from "@/lib/pricing/types";

/** A product as the distributor lists it. Shop-specific prices are kept apart, in `FieldShop.overrides`. */
export interface FieldSku {
  id: string;
  code: string;
  name: string;
  nameHi: string | null;
  brand: string;
  piecesPerCase: number;
  pricePaise: number; // dealer price per piece, GST-exclusive
  gstRateBp: number;
  stockCases: number;
  imageUrl: string | null;
  schemes: SchemeRule[];
}

export interface FieldShop {
  id: string;
  shopName: string;
  ownerName: string;
  city: string;
  phone: string;
  creditLimitPaise: number;
  outstandingPaise: number;
  openOrdersPaise: number; // placed or confirmed, not yet in Tally
  lastOrderAt: string | null; // ISO
  overrides: Record<string, number>; // skuId -> this shop's price per piece
}

export interface FieldRecentOrder {
  id: string;
  number: string;
  shopName: string;
  totalPaise: number;
  status: string;
  createdAt: string;
}

/** Everything a salesman's phone needs to work without a connection. */
export interface FieldSnapshot {
  syncedAt: string; // ISO, server time
  salesman: { id: string; name: string };
  skus: FieldSku[];
  shops: FieldShop[];
  recentOrders: FieldRecentOrder[];
}

/** The catalogue one shop would see, built on the phone from the shared product list. */
export function catalogueForShop(skus: FieldSku[], shop: FieldShop): CatalogueItem[] {
  return skus.map((s) => {
    const unitPricePaise = shop.overrides[s.id] ?? s.pricePaise;
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      nameHi: s.nameHi,
      brand: s.brand,
      piecesPerCase: s.piecesPerCase,
      unitPricePaise,
      casePricePaise: unitPricePaise * s.piecesPerCase,
      gstRateBp: s.gstRateBp,
      stockCases: s.stockCases,
      imageUrl: s.imageUrl ?? null,
      schemes: s.schemes,
    };
  });
}

/** Credit left for a shop, counting orders still waiting on the phone to be sent. */
export function creditLeftPaise(shop: FieldShop, unsentPaise = 0): number {
  return shop.creditLimitPaise - shop.outstandingPaise - shop.openOrdersPaise - unsentPaise;
}
