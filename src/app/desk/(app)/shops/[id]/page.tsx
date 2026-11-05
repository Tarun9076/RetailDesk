import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeskStatus } from "@/components/desk/desk-status";
import { EditShopForm } from "@/components/desk/edit-shop-form";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { getCreditPosition } from "@/lib/orders/exposure";

export default async function ShopPage(props: PageProps<"/desk/shops/[id]">) {
  await requireDesk();
  const { id } = await props.params;

  const shop = await db.retailer.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 30 },
      orders: { orderBy: { createdAt: "desc" }, take: 6, select: { id: true, number: true, status: true, totalPaise: true, createdAt: true } },
    },
  });
  if (!shop) notFound();

  const [salesmen, credit, open] = await Promise.all([
    db.user.findMany({ where: { role: "SALESMAN", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCreditPosition(id),
    db.order.count({ where: { retailerId: id, status: { in: ["PLACED", "ON_HOLD", "CONFIRMED"] } } }),
  ]);
  // The assigned salesman may have left; keep them in the list so saving does not silently drop them.
  const assigned = shop.salesmanId && !salesmen.some((s) => s.id === shop.salesmanId)
    ? await db.user.findUnique({ where: { id: shop.salesmanId }, select: { id: true, name: true } })
    : null;
  const options = assigned ? [...salesmen, { id: assigned.id, name: `${assigned.name} (switched off)` }] : salesmen;

  return (
    <div>
      <Link href="/desk/shops" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Shops
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{shop.shopName}</h1>
        {!shop.active && <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">Switched off</span>}
      </div>
      <p className="text-sm text-muted">{shop.name} · {shop.city} · {shop.phone}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Credit limit", formatPaise(credit.limitPaise)],
          ["Amount owed", formatPaise(credit.outstandingPaise)],
          ["Open orders", formatPaise(credit.openOrdersPaise)],
          ["Credit left", formatPaise(credit.availablePaise)],
        ].map(([k, val]) => (
          <div key={k} className="rounded-2xl border border-line p-4">
            <p className="text-sm text-muted">{k}</p>
            <p className={`mt-1 text-xl font-semibold ${k === "Credit left" && credit.availablePaise < 0 ? "text-danger" : ""}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <EditShopForm
          initial={{
            id: shop.id,
            shopName: shop.shopName,
            ownerName: shop.name,
            phone: shop.phone,
            city: shop.city,
            creditLimitPaise: shop.creditLimitPaise,
            outstandingPaise: shop.outstandingPaise,
            tallyLedgerName: shop.tallyLedgerName ?? "",
            salesmanId: shop.salesmanId ?? "",
            active: shop.active,
          }}
          salesmen={options}
          openOrders={open}
        />

        <div className="space-y-6">
          <section aria-labelledby="recent" className="rounded-2xl border border-line p-5">
            <h2 id="recent" className="text-lg font-semibold">Recent orders</h2>
            {shop.orders.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No orders yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {shop.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/desk/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-surface">
                      <span>
                        <span className="font-medium">{o.number}</span>
                        <span className="ml-2 text-xs text-muted">{formatDateTime(o.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <DeskStatus status={o.status} />
                        <span className="font-semibold">{formatPaise(o.totalPaise)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="history" className="rounded-2xl border border-line p-5">
            <h2 id="history" className="text-lg font-semibold">History</h2>
            {shop.events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No changes recorded yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {shop.events.map((e) => (
                  <li key={e.id} className="py-3 text-sm">
                    <p className="text-xs text-muted">{formatDateTime(e.createdAt)} · {e.byName}</p>
                    <p className="mt-0.5">{e.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
