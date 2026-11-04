"use client";

import { ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { fmt, plural, type Dict } from "@/lib/i18n/dict";
import { nextBenefitText, schemeText } from "@/lib/i18n/scheme";
import { formatPaise } from "@/lib/money";
import { maxOrderableCases } from "@/lib/pricing/engine";
import { useCart } from "./cart-provider";
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
      <div className="flex flex-col items-center py-20 text-center">
        <ShoppingBag size={40} aria-hidden className="text-muted" />
        <p className="mt-4 text-muted">{t.empty}</p>
        <Link
          href="/catalogue"
          className="mt-6 flex min-h-14 items-center rounded-xl bg-accent px-6 font-medium text-white hover:bg-accent-strong"
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>

      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
        {priced.lines.map((line) => {
          const item = byId.get(line.skuId)!;
          const name = lang === "hi" && item.nameHi ? item.nameHi : item.name;
          const max = maxOrderableCases(item.stockCases, item.scheme);
          return (
            <li key={line.skuId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {fmt(plural(line.qtyCases, t.casesOne, t.cases), { n: line.qtyCases })} ×{" "}
                    {formatPaise(item.casePricePaise)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatPaise(line.grossPaise)}</p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="w-44">
                  <QtyStepper value={line.qtyCases} max={max} onChange={(v) => setQty(line.skuId, v)} label={name} />
                </div>
                <button
                  type="button"
                  onClick={() => setQty(line.skuId, 0)}
                  className="flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm text-muted hover:bg-surface"
                >
                  <Trash2 size={16} aria-hidden />
                  {t.remove}
                </button>
              </div>

              <div className="mt-2 space-y-1 text-sm">
                {line.freeCases > 0 && item.scheme && (
                  <p className="font-medium text-accent">
                    {fmt(t.free, { n: line.freeCases })} · {schemeText(item.scheme, lang)}
                  </p>
                )}
                {line.discountPaise > 0 && item.scheme && (
                  <p className="font-medium text-accent">
                    −{formatPaise(line.discountPaise)} · {schemeText(item.scheme, lang)}
                  </p>
                )}
                {line.nextBenefit && (
                  <p className="text-muted">{nextBenefitText(line.nextBenefit, lang, line.freeCases > 0)}</p>
                )}
                {line.issue && (
                  <p role="alert" className="flex items-start gap-1.5 text-danger">
                    <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
                    {line.issue.code === "OUT_OF_STOCK"
                      ? t.outOfStock
                      : fmt(t.notEnough, { n: line.issue.maxOrderableCases })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <dl className="mt-5 space-y-2 rounded-2xl bg-surface p-4 text-[15px]">
        <div className="flex justify-between">
          <dt className="text-muted">{t.itemsTotal}</dt>
          <dd>{formatPaise(priced.subtotalPaise)}</dd>
        </div>
        {priced.discountPaise > 0 && (
          <div className="flex justify-between text-accent">
            <dt>{t.schemeSavings}</dt>
            <dd>−{formatPaise(priced.discountPaise)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">{t.gst}</dt>
          <dd>{formatPaise(priced.gstPaise)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
          <dt>{t.total}</dt>
          <dd>{formatPaise(priced.totalPaise)}</dd>
        </div>
        <div className="flex justify-between text-sm text-muted">
          <dt>{t.credit}</dt>
          <dd>{formatPaise(availableCreditPaise)}</dd>
        </div>
      </dl>

      {overCredit && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
          {t.creditWarning}
        </p>
      )}

      <div className="mt-4">
        <label htmlFor="note" className="mb-1.5 block text-sm font-medium text-muted">
          {t.note}
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          rows={2}
          lang={lang}
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base focus:border-accent"
        />
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-4">
        <Button type="button" disabled={blocked} onClick={place}>
          {busy ? t.placing : `${t.place} · ${formatPaise(priced.totalPaise)}`}
        </Button>
      </div>
    </div>
  );
}
