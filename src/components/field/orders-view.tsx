"use client";

import { CheckCircle2, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { describeChange, isUnsent, type QueuedOrder } from "@/lib/field/queue";
import { deleteOrder } from "@/lib/field/store";
import { formatDateTime } from "@/lib/format";
import { fmt, type Lang } from "@/lib/i18n/dict";
import type { FieldDict } from "@/lib/i18n/field";
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

const productName = (l: { name: string; nameHi?: string | null }, lang: Lang) => (lang === "hi" && l.nameHi ? l.nameHi : l.name);

/** What the office could not do, in the phone's current language. Older saved orders fall back to the English sentence. */
function problemText(o: QueuedOrder, f: FieldDict, lang: Lang): string {
  const p = o.problem;
  if (!p) return "";
  if (p.kind === "not_your_shop") return f.probNotYours;
  if (p.kind === "stock") {
    if (!p.issues?.length) return p.message || f.probStock;
    const byId = new Map(o.lines.map((l) => [l.skuId, l]));
    return p.issues
      .map((i) => {
        const line = byId.get(i.skuId);
        const name = line ? productName(line, lang) : "";
        return i.code === "OUT_OF_STOCK" ? fmt(f.probOut, { name }) : fmt(f.probMax, { name, n: i.max ?? 0 });
      })
      .join("; ");
  }
  return f.probInvalid;
}

function statusWord(s: string, f: FieldDict): string {
  return (f as unknown as Record<string, string>)[`st${s}`] ?? s.toLowerCase();
}

export function OrdersView() {
  const { queue, snapshot, online, syncing, syncNow, reloadQueue, go, f, lang } = useField();

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
          <h1 className="text-2xl font-semibold tracking-tight">{f.ordersTitle}</h1>
          <p className="mt-1 text-sm text-muted">{f.ordersSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing || !online}
          className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          <RefreshCw size={16} aria-hidden className={syncing ? "animate-spin" : ""} />
          {syncing ? f.sendingEllipsis : f.sendNow}
        </button>
      </div>

      {empty && <p className="py-16 text-center text-muted">{f.ordersEmpty}</p>}

      {attention.length > 0 && (
        <Section title={f.attentionTitle} hint={f.attentionHint}>
          {attention.map((o) => (
            <li key={o.id} className={`${card} border-amber-300 bg-amber-50`}>
              <p className="flex items-center gap-2 font-semibold text-amber-900">
                <TriangleAlert size={16} aria-hidden /> {o.shopName}
              </p>
              <p className="mt-1 text-sm text-amber-900">{problemText(o, f, lang)}</p>
              <OrderLines order={o} lang={lang} />
              <div className="mt-3 flex flex-wrap gap-2">
                {o.problem?.kind !== "not_your_shop" && (
                  <button type="button" onClick={() => void edit(o)} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong">
                    {f.changeAndSend}
                  </button>
                )}
                <button type="button" onClick={() => void discard(o)} className="min-h-11 rounded-xl border border-line bg-bg px-4 text-sm font-medium hover:bg-surface">
                  {f.discard}
                </button>
              </div>
            </li>
          ))}
        </Section>
      )}

      {waiting.length > 0 && (
        <Section title={f.waitingTitle} hint={online ? f.waitingOnline : f.waitingOffline}>
          {waiting.map((o) => (
            <li key={o.id} className={`${card} border-line`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <Clock size={16} aria-hidden className="text-amber-700" /> <span className="truncate">{o.shopName}</span>
                  </p>
                  <p className="text-sm text-muted">{fmt(f.takenAt, { when: formatDateTime(new Date(o.createdAt), lang) })}</p>
                </div>
                <p className="shrink-0 font-semibold">{formatPaise(o.expected.totalPaise)}</p>
              </div>
              <OrderLines order={o} lang={lang} />
              {o.status === "pending" && (
                <button type="button" onClick={() => void discard(o)} className="mt-3 min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-muted hover:bg-surface">
                  {f.cancelOrder}
                </button>
              )}
            </li>
          ))}
        </Section>
      )}

      {sent.length > 0 && (
        <Section title={f.sentTitle}>
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
                      {r.number} · {r.orderStatus === "ON_HOLD" ? f.onHoldText : f.withOffice}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatPaise(r.totalPaise)}</p>
                </div>
                {change.changed && (
                  <div role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">
                      {change.totalDeltaPaise === 0
                        ? f.linesChanged
                        : fmt(f.totalChanged, {
                            from: formatPaise(o.expected.totalPaise),
                            to: formatPaise(r.totalPaise),
                            delta: `${change.totalDeltaPaise > 0 ? "+" : "−"}${formatPaise(Math.abs(change.totalDeltaPaise))}`,
                          })}
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {change.lines.map((l) => (
                        <li key={l.skuId}>
                          {productName(l, lang)}: {formatPaise(l.expectedPaise)} → {formatPaise(l.actualPaise)}
                          {l.expectedFree !== l.actualFree && fmt(f.freeCasesChanged, { a: l.expectedFree, b: l.actualFree })}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs">{f.movedNote}</p>
                  </div>
                )}
              </li>
            );
          })}
        </Section>
      )}

      {earlier.length > 0 && (
        <Section title={f.earlierTitle}>
          {earlier.map((o) => (
            <li key={o.id} className={`${card} flex items-start justify-between gap-3 border-line`}>
              <div className="min-w-0">
                <p className="truncate font-semibold">{o.shopName}</p>
                <p className="text-sm text-muted">
                  {o.number} · {formatDateTime(new Date(o.createdAt), lang)} · {statusWord(o.status, f)}
                </p>
              </div>
              <p className="shrink-0 font-semibold">{formatPaise(o.totalPaise)}</p>
            </li>
          ))}
        </Section>
      )}

      {!online && sent.length === 0 && earlier.length > 0 && <p className="mt-4 text-xs text-muted">{f.statusesAsOf}</p>}
      <div className="mt-8">
        <Button type="button" variant="ghost" onClick={() => go("#/")}>
          {f.backToShops}
        </Button>
      </div>
    </div>
  );
}

function OrderLines({ order, lang }: { order: QueuedOrder; lang: Lang }) {
  return (
    <ul className="mt-2 space-y-0.5 text-sm text-muted">
      {order.lines.map((l) => (
        <li key={l.skuId}>
          {l.qtyCases} × {productName(l, lang)}
        </li>
      ))}
    </ul>
  );
}
