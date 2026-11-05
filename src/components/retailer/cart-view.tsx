"use client";

import { ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ErrorNote } from "@/components/ui";
import { fmt, plural, type Dict } from "@/lib/i18n/dict";
import { nextBenefitText, schemeText } from "@/lib/i18n/scheme";
import { formatPaise } from "@/lib/money";
import { splitProductName } from "@/lib/product-look";
import { maxOrderableCases } from "@/lib/pricing/engine";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";
import { QtyStepper } from "./qty-stepper";

export function CartView({
  t,
  availableCreditPaise,
}: {
  t: Dict["cart"];
  availableCreditPaise: number;
}) {
  const router = useRouter();
  const { items, lang, qty, priced, setQty, clear, hydrated, captureId } = useCart();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh key per distinct cart: a retry after a dropped connection reuses it
  // (so the order is never doubled), while an edited cart is a new order.
  const signature = JSON.stringify(qty);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on cart contents
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [signature]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Wait for the saved cart to load so a full cart never flashes as "empty".
  if (!hydrated) return <div className="min-h-64" aria-busy="true" />;

  if (priced.lines.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <ShoppingBag size={36} aria-hidden className="text-muted" />
        <p className="mt-4 text-muted">{t.empty}</p>
        <Link
          href="/catalogue"
          className="mt-6 flex min-h-12 items-center rounded-xl bg-accent px-6 font-medium text-white hover:bg-accent-strong"
        >
          {t.browse}
        </Link>
      </div>
    );
  }

  const overCredit = priced.totalPaise > availableCreditPaise;

  async function place() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          captureId: captureId ?? undefined,
          note: note.trim() || undefined,
          lines: priced.lines.map((l) => ({ skuId: l.skuId, qtyCases: l.qtyCases })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { orderId?: string };
      if (res.ok && data.orderId) {
        clear();
        router.push(`/orders/${data.orderId}?new=1`);
        return;
      }
      if (res.status === 409) {
        setError(t.stockChanged);
        router.refresh(); // pull the latest stock into the catalogue
      } else {
        setError(t.failed);
      }
    } catch {
      setError(t.network);
    }
    setBusy(false);
  }

  const blocked = priced.hasIssues || busy;
  const placeLabel = busy ? t.placing : t.place;

  return (
    <div className="mx-auto max-w-2xl lg:max-w-none">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>

      {/* One column on a phone; items beside a sticky summary once there is room. */}
      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <ul className="divide-y divide-line">
          {priced.lines.map((line) => {
            const item = byId.get(line.skuId)!;
            const name = lang === "hi" && item.nameHi ? item.nameHi : item.name;
            const { title } = splitProductName(name);
            const max = maxOrderableCases(item.stockCases, item.schemes);
            return (
              <li key={line.skuId} className="flex gap-4 py-5 first:pt-0">
                <div className="w-20 shrink-0 sm:w-24">
                  <ProductImage name={item.name} brand={item.brand} imageUrl={item.imageUrl} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{title}</p>
                      <p className="mt-0.5 text-sm text-muted tabular-nums">
                        {fmt(plural(line.qtyCases, t.casesOne, t.cases), { n: line.qtyCases })} × {formatPaise(item.casePricePaise)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatPaise(line.grossPaise)}</p>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-36">
                      <QtyStepper value={line.qtyCases} max={max} onChange={(v) => setQty(line.skuId, v)} label={title} compact />
                    </div>
                    <button
                      type="button"
                      onClick={() => setQty(line.skuId, 0)}
                      aria-label={`${t.remove}: ${title}`}
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-danger"
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </div>

                  <div className="mt-2 space-y-0.5 text-sm">
                    {line.freeCases > 0 && line.appliedScheme && (
                      <p className="font-medium text-accent">
                        {fmt(t.free, { n: line.freeCases })} · {schemeText(line.appliedScheme, lang)}
                      </p>
                    )}
                    {line.discountPaise > 0 && line.appliedScheme && (
                      <p className="font-medium text-accent tabular-nums">
                        −{formatPaise(line.discountPaise)} · {schemeText(line.appliedScheme, lang)}
                      </p>
                    )}
                    {line.nextBenefit && (
                      <p className="text-muted">{nextBenefitText(line.nextBenefit, lang, line.freeCases > 0)}</p>
                    )}
                    {line.issue && (
                      <p role="alert" className="flex items-start gap-1.5 text-danger">
                        <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
                        {line.issue.code === "OUT_OF_STOCK" ? t.outOfStock : fmt(t.notEnough, { n: line.issue.maxOrderableCases })}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="mt-8 pb-28 lg:sticky lg:top-40 lg:mt-0 lg:pb-0">
          <dl className="space-y-2.5 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-muted">{t.itemsTotal}</dt>
              <dd className="tabular-nums">{formatPaise(priced.subtotalPaise)}</dd>
            </div>
            {priced.discountPaise > 0 && (
              <div className="flex justify-between text-accent">
                <dt>{t.schemeSavings}</dt>
                <dd className="tabular-nums">−{formatPaise(priced.discountPaise)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">{t.gst}</dt>
              <dd className="tabular-nums">{formatPaise(priced.gstPaise)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="text-base font-medium">{t.total}</dt>
              <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatPaise(priced.totalPaise)}</dd>
            </div>
            <div className="flex justify-between text-sm text-muted">
              <dt>{t.credit}</dt>
              <dd className="tabular-nums">{formatPaise(availableCreditPaise)}</dd>
            </div>
          </dl>

          {overCredit && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
              {t.creditWarning}
            </p>
          )}

          {/* A note is rare, so it stays folded away until asked for. */}
          <details className="mt-4 group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-accent">
              {t.note}
            </summary>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              lang={lang}
              aria-label={t.note}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-4 py-3 text-base focus:border-accent"
            />
          </details>

          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          {/* On a phone the button waits at the bottom of the screen, under the thumb; beside the summary on a laptop. */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <button
              type="button"
              disabled={blocked}
              onClick={place}
              className="mx-auto flex min-h-14 w-full max-w-2xl items-center justify-between rounded-2xl bg-accent px-5 text-base font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/50 lg:max-w-none"
            >
              <span>{placeLabel}</span>
              <span className="text-lg font-semibold tabular-nums">{formatPaise(priced.totalPaise)}</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
