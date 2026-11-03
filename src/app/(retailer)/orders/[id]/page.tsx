import { CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@/components/retailer/order-status";
import { RepeatOrderButton } from "@/components/retailer/repeat-order-button";
import { requireRetailer } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { fmt, plural } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";
import { formatPaise } from "@/lib/money";

export default async function OrderDetailPage(props: PageProps<"/orders/[id]">) {
  const { retailer } = await requireRetailer();
  const { lang, t } = await getDict();
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;

  // The retailerId filter is the access check: other shops' orders look like "not found".
  const order = await db.order.findFirst({
    where: { id, retailerId: retailer.id },
    include: { lines: { include: { sku: true }, orderBy: { sku: { name: "asc" } } } },
  });

  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">{t.orders.notFound}</p>
        <Link href="/orders" className="mt-4 inline-block min-h-12 py-3 font-medium text-accent">
          {t.orders.all}
        </Link>
      </div>
    );
  }

  const held = order.status === "ON_HOLD";
  return (
    <div className="mx-auto max-w-2xl">
      {isNew && (
        <div
          className={`mb-5 flex items-start gap-3 rounded-2xl p-4 ${held ? "bg-amber-50 text-amber-900" : "bg-accent-soft text-accent-strong"}`}
        >
          {held ? <Clock size={22} aria-hidden className="mt-0.5 shrink-0" /> : <CheckCircle2 size={22} aria-hidden className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-semibold">{t.orders.placedTitle}</p>
            <p className="text-sm">{held ? t.orders.heldBody : t.orders.placedBody}</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fmt(t.orders.number, { n: order.number })}</h1>
          <p className="text-sm text-muted">
            {new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}
          </p>
        </div>
        <OrderStatus status={order.status} t={t.orders.status} />
      </div>

      <ul className="mt-5 divide-y divide-line rounded-2xl border border-line">
        {order.lines.map((l) => (
          <li key={l.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium leading-snug">{lang === "hi" && l.sku.nameHi ? l.sku.nameHi : l.sku.name}</p>
              <p className="text-sm text-muted">
                {fmt(plural(l.qtyCases, t.cart.casesOne, t.cart.cases), { n: l.qtyCases })}
                {l.freeCases > 0 && <span className="text-accent"> · {fmt(t.orders.free, { n: l.freeCases })}</span>}
              </p>
              {l.discountPaise > 0 && <p className="text-sm text-accent">−{formatPaise(l.discountPaise)}</p>}
            </div>
            <p className="shrink-0 font-medium">{formatPaise(l.grossPaise - l.discountPaise + l.gstPaise)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-5 space-y-2 rounded-2xl bg-surface p-4 text-[15px]">
        <div className="flex justify-between">
          <dt className="text-muted">{t.cart.itemsTotal}</dt>
          <dd>{formatPaise(order.subtotalPaise)}</dd>
        </div>
        {order.discountPaise > 0 && (
          <div className="flex justify-between text-accent">
            <dt>{t.cart.schemeSavings}</dt>
            <dd>−{formatPaise(order.discountPaise)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">{t.cart.gst}</dt>
          <dd>{formatPaise(order.gstPaise)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
          <dt>{t.cart.total}</dt>
          <dd>{formatPaise(order.totalPaise)}</dd>
        </div>
      </dl>

      {order.note && (
        <p className="mt-4 text-sm text-muted">
          {t.orders.note}: <span className="text-ink">{order.note}</span>
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <RepeatOrderButton lines={order.lines.map((l) => ({ skuId: l.skuId, qtyCases: l.qtyCases }))} label={t.orders.repeat} />
        <Link
          href="/catalogue"
          className="flex min-h-12 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong"
        >
          {t.orders.back}
        </Link>
      </div>
    </div>
  );
}
