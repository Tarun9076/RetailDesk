import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@/components/retailer/order-status";
import { RepeatOrderButton } from "@/components/retailer/repeat-order-button";
import { requireRetailer } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { fmt, plural } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";

export default async function OrdersPage() {
  const { retailer } = await requireRetailer();
  const { lang, t } = await getDict();

  // Scoped to the signed-in retailer: another shop's orders are never queried.
  const orders = await db.order.findMany({
    where: { retailerId: retailer.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { lines: { select: { skuId: true, qtyCases: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl md:max-w-none">
      <h1 className="text-2xl font-semibold tracking-tight">{t.orders.title}</h1>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <ClipboardList size={40} aria-hidden className="text-muted" />
          <p className="mt-4 text-muted">{t.orders.empty}</p>
          <Link
            href="/catalogue"
            className="mt-6 flex min-h-14 items-center rounded-xl bg-accent px-6 font-medium text-white hover:bg-accent-strong"
          >
            {t.orders.back}
          </Link>
        </div>
      ) : (
        // A list on a phone, a grid of cards on a tablet or laptop.
        // A plain list on a phone (rules between rows, no boxes); quiet cards on a tablet or laptop.
        <ul className="mt-4 divide-y divide-line md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 lg:grid-cols-3">
          {orders.map((o) => (
            <li key={o.id} className="py-4 md:rounded-2xl md:border md:border-line md:p-5">
              <Link href={`/orders/${o.id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{fmt(t.orders.number, { n: o.number })}</p>
                    <p className="text-sm text-muted">
                      {formatDate(o.createdAt, lang)} · {fmt(plural(o.lines.length, t.orders.itemsOne, t.orders.items), { n: o.lines.length })}
                    </p>
                  </div>
                  <OrderStatus status={o.status} t={t.orders.status} />
                </div>
                <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">{formatPaise(o.totalPaise)}</p>
              </Link>
              <div className="mt-3">
                <RepeatOrderButton lines={o.lines} label={t.orders.repeat} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
