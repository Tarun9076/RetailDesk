import "server-only";
import { db } from "@/lib/db";
import { dayKey, fillDays, periodFor, type DayPoint, type Period, type RangeKey } from "@/lib/sales";

/**
 * What counts as a sale: orders the desk has confirmed or exported. Orders
 * still waiting (to check, on hold) are shown separately as "waiting", and
 * cancelled orders count for nothing. Money is the order date's, in Indian time.
 */
export interface Totals {
  orders: number;
  netPaise: number; // after scheme discounts, before GST
  gstPaise: number;
  totalPaise: number; // what the shop is billed, GST included
  discountPaise: number; // scheme discounts given
  cases: number;
  freeCases: number; // given away under "buy N get M" schemes
}

export interface TopProduct {
  name: string;
  code: string;
  cases: number;
  freeCases: number;
  netPaise: number;
}

export interface TopShop {
  shopName: string;
  city: string;
  orders: number;
  netPaise: number;
}

export interface ChannelSplit {
  catalogue: { orders: number; netPaise: number };
  ai: { orders: number; netPaise: number };
}

export interface SalesData {
  period: Period;
  current: Totals;
  previous: Totals;
  daily: DayPoint[];
  topProducts: TopProduct[];
  topShops: TopShop[];
  channels: ChannelSplit;
  waiting: { orders: number; totalPaise: number; onHold: number };
}

const num = (v: bigint | number | null | undefined) => Number(v ?? 0);
const emptyTotals = (): Totals => ({ orders: 0, netPaise: 0, gstPaise: 0, totalPaise: 0, discountPaise: 0, cases: 0, freeCases: 0 });

export async function loadSales(key: RangeKey, now: Date = new Date()): Promise<SalesData> {
  const p = periodFor(key, now);

  const [dailyRows, lineRows, productRows, shopRows, channelRows, waitingRows] = await Promise.all([
    // One scan over both this period and the one before it, grouped by Indian day.
    db.$queryRaw<{ day: string; orders: number; net: bigint; gst: bigint; total: bigint; discount: bigint }[]>`
      SELECT to_char(((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS orders,
             COALESCE(SUM(o."subtotalPaise" - o."discountPaise"), 0)::bigint AS net,
             COALESCE(SUM(o."gstPaise"), 0)::bigint AS gst,
             COALESCE(SUM(o."totalPaise"), 0)::bigint AS total,
             COALESCE(SUM(o."discountPaise"), 0)::bigint AS discount
      FROM "Order" o
      WHERE o.status IN ('CONFIRMED', 'EXPORTED')
        AND o."createdAt" >= ${p.prevFrom} AND o."createdAt" < ${p.to}
      GROUP BY 1
      ORDER BY 1`,
    db.$queryRaw<{ period: string; cases: number; free: number }[]>`
      SELECT CASE WHEN o."createdAt" >= ${p.from} THEN 'cur' ELSE 'prev' END AS period,
             COALESCE(SUM(l."qtyCases"), 0)::int AS cases,
             COALESCE(SUM(l."freeCases"), 0)::int AS free
      FROM "OrderLine" l
      JOIN "Order" o ON o.id = l."orderId"
      WHERE o.status IN ('CONFIRMED', 'EXPORTED')
        AND o."createdAt" >= ${p.prevFrom} AND o."createdAt" < ${p.to}
      GROUP BY 1`,
    db.$queryRaw<{ name: string; code: string; cases: number; free: number; net: bigint }[]>`
      SELECT s."name" AS name, s."code" AS code,
             SUM(l."qtyCases")::int AS cases, SUM(l."freeCases")::int AS free,
             SUM(l."grossPaise" - l."discountPaise")::bigint AS net
      FROM "OrderLine" l
      JOIN "Order" o ON o.id = l."orderId"
      JOIN "Sku" s ON s.id = l."skuId"
      WHERE o.status IN ('CONFIRMED', 'EXPORTED') AND o."createdAt" >= ${p.from} AND o."createdAt" < ${p.to}
      GROUP BY s."name", s."code"
      ORDER BY net DESC, s."name"
      LIMIT 8`,
    db.$queryRaw<{ shop: string; city: string; orders: number; net: bigint }[]>`
      SELECT r."shopName" AS shop, r."city" AS city, COUNT(*)::int AS orders,
             SUM(o."subtotalPaise" - o."discountPaise")::bigint AS net
      FROM "Order" o
      JOIN "Retailer" r ON r.id = o."retailerId"
      WHERE o.status IN ('CONFIRMED', 'EXPORTED') AND o."createdAt" >= ${p.from} AND o."createdAt" < ${p.to}
      GROUP BY r.id, r."shopName", r."city"
      ORDER BY net DESC, r."shopName"
      LIMIT 8`,
    // Channel: every order placed in the period that was not cancelled, so a new AI order
    // counts as adoption straight away, before the desk has confirmed it.
    db.$queryRaw<{ source: string; orders: number; net: bigint }[]>`
      SELECT o.source::text AS source, COUNT(*)::int AS orders,
             COALESCE(SUM(o."subtotalPaise" - o."discountPaise"), 0)::bigint AS net
      FROM "Order" o
      WHERE o.status <> 'CANCELLED' AND o."createdAt" >= ${p.from} AND o."createdAt" < ${p.to}
      GROUP BY 1`,
    db.$queryRaw<{ status: string; orders: number; total: bigint }[]>`
      SELECT o.status::text AS status, COUNT(*)::int AS orders, COALESCE(SUM(o."totalPaise"), 0)::bigint AS total
      FROM "Order" o
      WHERE o.status IN ('PLACED', 'ON_HOLD')
      GROUP BY 1`,
  ]);

  // Split the two periods apart, and add up each.
  const currentFirstDay = dayKey(p.from);
  const current = emptyTotals();
  const previous = emptyTotals();
  const curRows: DayPoint[] = [];
  for (const r of dailyRows) {
    const t = r.day >= currentFirstDay ? current : previous;
    t.orders += r.orders;
    t.netPaise += num(r.net);
    t.gstPaise += num(r.gst);
    t.totalPaise += num(r.total);
    t.discountPaise += num(r.discount);
    if (r.day >= currentFirstDay) curRows.push({ day: r.day, orders: r.orders, netPaise: num(r.net) });
  }
  for (const r of lineRows) {
    const t = r.period === "cur" ? current : previous;
    t.cases = r.cases;
    t.freeCases = r.free;
  }

  const channel = (source: string) => {
    const row = channelRows.find((c) => c.source === source);
    return { orders: row?.orders ?? 0, netPaise: num(row?.net) };
  };

  return {
    period: p,
    current,
    previous,
    daily: fillDays(curRows, p.from, p.days),
    topProducts: productRows.map((r) => ({ name: r.name, code: r.code, cases: r.cases, freeCases: r.free, netPaise: num(r.net) })),
    topShops: shopRows.map((r) => ({ shopName: r.shop, city: r.city, orders: r.orders, netPaise: num(r.net) })),
    channels: { catalogue: channel("CATALOGUE"), ai: channel("AI_TEXT") },
    waiting: {
      orders: waitingRows.reduce((s, r) => s + r.orders, 0),
      totalPaise: waitingRows.reduce((s, r) => s + num(r.total), 0),
      onHold: waitingRows.find((r) => r.status === "ON_HOLD")?.orders ?? 0,
    },
  };
}
