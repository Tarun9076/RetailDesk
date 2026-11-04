"use client";

import { CheckCircle2, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { describeChange, isUnsent, type QueuedOrder } from "@/lib/field/queue";
import { deleteOrder } from "@/lib/field/store";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { useField } from "./field-context";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <ul className="mt-3 space-y-3">{children}</ul>
    </section>
  );
}

const card = "rounded-2xl border p-4";

export function OrdersView() {
  const { queue, snapshot, online, syncing, syncNow, reloadQueue, go } = useField();

  const attention = queue.filter((o) => o.status === "needs_attention");
  const waiting = queue.filter(isUnsent);
  const sent = queue.filter((o) => o.status === "sent").reverse();
  // Orders from earlier, from the server, that this phone did not just send.
  const sentNumbers = new Set(sent.map((o) => o.result?.number));
  const earlier = snapshot.recentOrders.filter((o) => !sentNumbers.has(o.number));

  async function discard(o: QueuedOrder) {
    await deleteOrder(o.id);
    await reloadQueue();
  }

  /** Puts the lines back in the shop's cart so the salesman can adjust and send again. */
  async function edit(o: QueuedOrder) {
    try {
      const cart = Object.fromEntries(o.lines.map((l) => [l.skuId, l.qtyCases]));
      localStorage.setItem(`rd_cart:${o.shopId}`, JSON.stringify(cart));
    } catch {
      /* storage blocked: the salesman re-enters it */
    }
    await deleteOrder(o.id);
    await reloadQueue();
    go(`#/shop/${encodeURIComponent(o.shopId)}/cart`);
  }

  const empty = attention.length + waiting.length + sent.length + earlier.length === 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted">What you took for your shops, and where each one is.</p>
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing || !online}
          className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          <RefreshCw size={16} aria-hidden className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sending…" : "Send now"}
        </button>
      </div>

      {empty && <p className="py-16 text-center text-muted">No orders yet. Open a shop and add some products.</p>}

      {attention.length > 0 && (
        <Section title="Needs your attention" hint="The office could not accept these as they were.">
          {attention.map((o) => (
            <li key={o.id} className={`${card} border-amber-300 bg-amber-50`}>
              <p className="flex items-center gap-2 font-semibold text-amber-900">
                <TriangleAlert size={16} aria-hidden /> {o.shopName}
              </p>
              <p className="mt-1 text-sm text-amber-900">{o.problem?.message}</p>
              <OrderLines order={o} />
              <div className="mt-3 flex flex-wrap gap-2">
                {o.problem?.kind !== "not_your_shop" && (
                  <button type="button" onClick={() => void edit(o)} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong">
                    Change and send again
                  </button>
                )}
                <button type="button" onClick={() => void discard(o)} className="min-h-11 rounded-xl border border-line bg-bg px-4 text-sm font-medium hover:bg-surface">
                  Discard
                </button>
              </div>
            </li>
          ))}
        </Section>
      )}

      {waiting.length > 0 && (
        <Section title="Waiting to be sent" hint={online ? "Sending now." : "Saved on this phone. They go as soon as you are online."}>
          {waiting.map((o) => (
            <li key={o.id} className={`${card} border-line`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <Clock size={16} aria-hidden className="text-amber-700" /> <span className="truncate">{o.shopName}</span>
                  </p>
                  <p className="text-sm text-muted">Taken {formatDateTime(new Date(o.createdAt))}</p>
                </div>
                <p className="shrink-0 font-semibold">{formatPaise(o.expected.totalPaise)}</p>
              </div>
              <OrderLines order={o} />
              {o.status === "pending" && (
                <button type="button" onClick={() => void discard(o)} className="mt-3 min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-muted hover:bg-surface">
                  Cancel this order
                </button>
              )}
            </li>
          ))}
        </Section>
      )}

      {sent.length > 0 && (
        <Section title="Sent to the office">
          {sent.map((o) => {
            const change = describeChange(o);
            const r = o.result!;
            return (
              <li key={o.id} className={`${card} border-line`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={16} aria-hidden className="text-accent" /> <span className="truncate">{o.shopName}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {r.number} · {r.orderStatus === "ON_HOLD" ? "on hold for credit approval" : "with the office"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatPaise(r.totalPaise)}</p>
                </div>
                {change.changed && (
                  <div role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">
                      {change.totalDeltaPaise === 0
                        ? "Some lines changed while you were offline."
                        : `The total changed from ${formatPaise(o.expected.totalPaise)} to ${formatPaise(r.totalPaise)} (${
                            change.totalDeltaPaise > 0 ? "+" : "−"
                          }${formatPaise(Math.abs(change.totalDeltaPaise))}).`}
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {change.lines.map((l) => (
                        <li key={l.skuId}>
                          {l.name}: {formatPaise(l.expectedPaise)} → {formatPaise(l.actualPaise)}
                          {l.expectedFree !== l.actualFree && `, free cases ${l.expectedFree} → ${l.actualFree}`}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs">A price, a scheme or the stock moved. The office price is the one that counts. Tell the shopkeeper.</p>
                  </div>
                )}
              </li>
            );
          })}
        </Section>
      )}

      {earlier.length > 0 && (
        <Section title="Earlier orders">
          {earlier.map((o) => (
            <li key={o.id} className={`${card} flex items-start justify-between gap-3 border-line`}>
              <div className="min-w-0">
                <p className="truncate font-semibold">{o.shopName}</p>
                <p className="text-sm text-muted">
                  {o.number} · {formatDateTime(new Date(o.createdAt))} · {statusWord(o.status)}
                </p>
              </div>
              <p className="shrink-0 font-semibold">{formatPaise(o.totalPaise)}</p>
            </li>
          ))}
        </Section>
      )}

      {!online && sent.length === 0 && earlier.length > 0 && (
        <p className="mt-4 text-xs text-muted">Statuses are as of the last sync.</p>
      )}
      <div className="mt-8">
        <Button type="button" variant="ghost" onClick={() => go("#/")}>
          Back to my shops
        </Button>
      </div>
    </div>
  );
}

function OrderLines({ order }: { order: QueuedOrder }) {
  return (
    <ul className="mt-2 space-y-0.5 text-sm text-muted">
      {order.lines.map((l) => (
        <li key={l.skuId}>
          {l.qtyCases} × {l.name}
        </li>
      ))}
    </ul>
  );
}

function statusWord(s: string): string {
  switch (s) {
    case "PLACED":
      return "with the office";
    case "ON_HOLD":
      return "on hold";
    case "CONFIRMED":
      return "confirmed";
    case "EXPORTED":
      return "billed";
    case "CANCELLED":
      return "cancelled";
    default:
      return s.toLowerCase();
  }
}
