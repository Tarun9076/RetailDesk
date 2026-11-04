import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeProduct } from "@/components/desk/change-product";
import { DeskActions } from "@/components/desk/desk-actions";
import { DeskStatus } from "@/components/desk/desk-status";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTimeLong } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { getCreditPosition } from "@/lib/orders/exposure";

const EVENT_LABEL: Record<string, string> = {
  REVISE: "Product changed",
  CONFIRM: "Confirmed",
  RELEASE: "Credit hold released",
  CANCEL: "Cancelled",
  EXPORT: "Exported to Tally",
};

export default async function DeskOrderPage(props: PageProps<"/desk/orders/[id]">) {
  await requireDesk();
  const { id } = await props.params;
  const { revised } = await props.searchParams;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      retailer: { include: { salesman: { select: { name: true } } } },
      placedBy: { select: { name: true } },
      lines: { include: { sku: true }, orderBy: { sku: { name: "asc" } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const [credit, skuOptions] = await Promise.all([
    getCreditPosition(order.retailerId),
    order.status === "PLACED" || order.status === "ON_HOLD"
      ? db.sku.findMany({
          where: { active: true },
          select: { id: true, name: true, stockCases: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const editable = order.status === "PLACED" || order.status === "ON_HOLD";
  // A held order is not counted in "used", so compare it against what is left.
  const overBy = order.status === "ON_HOLD" ? order.totalPaise - credit.availablePaise : 0;

  return (
    <div>
      <Link href="/desk" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> All orders
      </Link>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{order.number}</h1>
        <DeskStatus status={order.status} />
        {order.source === "AI_TEXT" && (
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
            AI captured
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {order.placedBy ? (
          <>
            Taken by salesman <span className="font-medium text-ink">{order.placedBy.name}</span> for the shop.{" "}
          </>
        ) : null}
        Received {formatDateTimeLong(order.createdAt)}
        {order.capturedAt && Math.abs(order.createdAt.getTime() - order.capturedAt.getTime()) > 10 * 60_000
          ? `, taken offline at ${formatDateTimeLong(order.capturedAt)}`
          : ""}
      </p>
      {order.retailer.salesman && !order.placedBy && (
        <p className="text-sm text-muted">Shop&apos;s salesman: {order.retailer.salesman.name}</p>
      )}

      {revised && (
        <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          Product changed and the order was priced again.
          {revised === "learned" &&
            ` Remembered: the next time ${order.retailer.shopName} writes those words, this product is suggested.`}
        </p>
      )}

      <div className="mt-5">
        <DeskActions
          orderId={order.id}
          status={order.status}
          overByLabel={overBy > 0 ? formatPaise(overBy) : null}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {order.rawMessage && (
            <section className="rounded-2xl border border-line p-4">
              <h2 className="text-sm font-medium text-muted">Original message</h2>
              <p className="mt-2 whitespace-pre-wrap">{order.rawMessage}</p>
            </section>
          )}

          <section aria-label="Items" className="rounded-2xl border border-line">
            <ul className="divide-y divide-line">
              {order.lines.map((l) => (
                <li key={l.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{l.sku.name}</p>
                      <p className="text-xs text-muted">{l.sku.code}</p>
                      <p className="mt-1 text-sm">
                        {l.qtyCases} {l.qtyCases === 1 ? "case" : "cases"}
                        {l.freeCases > 0 && <span className="font-medium text-accent"> + {l.freeCases} free</span>}
                        <span className="text-muted">
                          {" "}
                          × {formatPaise(l.unitPricePaise * l.sku.piecesPerCase)}
                        </span>
                      </p>
                      {l.discountPaise > 0 && (
                        <p className="text-sm text-accent">
                          {l.schemeLabel ?? "Scheme"}: −{formatPaise(l.discountPaise)}
                        </p>
                      )}
                      {l.originalText && (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span>Wrote: “{l.originalText}”</span>
                          {l.confidence !== null && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                l.confidence >= 0.8
                                  ? "bg-accent-soft text-accent"
                                  : l.confidence >= 0.5
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-danger-soft text-danger"
                              }`}
                            >
                              {l.confidence >= 0.8 ? "AI sure" : l.confidence >= 0.5 ? "Check this line" : "AI not sure"}
                            </span>
                          )}
                        </p>
                      )}
                      {editable && (
                        <ChangeProduct
                          orderId={order.id}
                          lineId={l.id}
                          currentSkuId={l.skuId}
                          options={skuOptions}
                          shop={order.retailer.shopName}
                          remembers={!!l.originalText}
                        />
                      )}
                    </div>
                    <p className="shrink-0 font-semibold">
                      {formatPaise(l.grossPaise - l.discountPaise + l.gstPaise)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-line bg-surface p-4 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-muted">Items (excl. GST)</dt>
                <dd>{formatPaise(order.subtotalPaise)}</dd>
              </div>
              {order.discountPaise > 0 && (
                <div className="flex justify-between text-accent">
                  <dt>Scheme discount</dt>
                  <dd>−{formatPaise(order.discountPaise)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">GST</dt>
                <dd>{formatPaise(order.gstPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
                <dt>Total (incl. GST)</dt>
                <dd>{formatPaise(order.totalPaise)}</dd>
              </div>
            </dl>
          </section>

          {order.note && (
            <section className="rounded-2xl border border-line p-4">
              <h2 className="text-sm font-medium text-muted">Note from the shop</h2>
              <p className="mt-2 whitespace-pre-wrap">{order.note}</p>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-line p-4">
            <h2 className="text-sm font-medium text-muted">Shop</h2>
            <p className="mt-1 font-semibold">{order.retailer.shopName}</p>
            <p className="text-sm text-muted">
              {order.retailer.name} · {order.retailer.city}
            </p>
            <p className="text-sm text-muted">{order.retailer.phone}</p>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Credit limit</dt>
                <dd>{formatPaise(credit.limitPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Account balance</dt>
                <dd>{formatPaise(credit.outstandingPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Open orders</dt>
                <dd>{formatPaise(credit.openOrdersPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-medium">
                <dt>Available</dt>
                <dd className={credit.availablePaise < 0 ? "text-danger" : ""}>{formatPaise(credit.availablePaise)}</dd>
              </div>
            </dl>

            {order.status === "ON_HOLD" && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {order.holdReason ?? "Over credit limit"}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line p-4">
            <h2 className="text-sm font-medium text-muted">History</h2>
            <ol className="mt-3 space-y-3 text-sm">
              <li>
                <p className="font-medium">Order placed</p>
                <p className="text-muted">{formatDateTimeLong(order.createdAt)}</p>
              </li>
              {order.events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium">{EVENT_LABEL[e.action] ?? e.action}</p>
                  <p className="text-muted">
                    {e.byName} · {formatDateTimeLong(e.createdAt)}
                  </p>
                  {e.note && e.action !== "EXPORT" && <p className="mt-0.5">“{e.note}”</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
