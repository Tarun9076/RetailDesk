"use client";

import { ArrowLeft, Phone, ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { CartProvider, useCart } from "@/components/retailer/cart-provider";
import { CatalogueView } from "@/components/retailer/catalogue-view";
import { QtyStepper } from "@/components/retailer/qty-stepper";
import { Button } from "@/components/ui";
import { timeAgo } from "@/lib/field/ago";
import { newQueuedOrder, unsentPaiseFor } from "@/lib/field/queue";
import { putOrder } from "@/lib/field/store";
import { catalogueForShop, creditLeftPaise, type FieldShop } from "@/lib/field/types";
import { nextBenefitText, schemeText } from "@/lib/i18n/scheme";
import { formatPaise } from "@/lib/money";
import { maxOrderableCases } from "@/lib/pricing/engine";
import { useField } from "./field-context";

export function ShopView({ shopId, showCart }: { shopId: string; showCart: boolean }) {
  const { snapshot, lang, go } = useField();
  const shop = snapshot.shops.find((s) => s.id === shopId);
  const items = useMemo(() => (shop ? catalogueForShop(snapshot.skus, shop) : []), [snapshot.skus, shop]);

  if (!shop) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">This shop is not on your list. It may have been reassigned.</p>
        <div className="mx-auto mt-6 max-w-xs">
          <Button type="button" onClick={() => go("#/")}>
            Back to my shops
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CartProvider retailerId={shop.id} items={items} lang={lang}>
      <ShopHeader shop={shop} />
      {showCart ? <FieldCart shop={shop} /> : <Browse shop={shop} />}
    </CartProvider>
  );
}

function ShopHeader({ shop }: { shop: FieldShop }) {
  const { snapshot, queue, go } = useField();
  const left = creditLeftPaise(shop, unsentPaiseFor(queue, shop.id));
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => go("#/")}
        className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted hover:bg-surface"
      >
        <ArrowLeft size={16} aria-hidden /> My shops
      </button>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{shop.shopName}</h1>
          <p className="text-sm text-muted">
            {shop.ownerName} · {shop.city}
          </p>
        </div>
        <a
          href={`tel:${shop.phone}`}
          aria-label={`Call ${shop.ownerName}`}
          className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-line hover:bg-surface"
        >
          <Phone size={18} aria-hidden />
        </a>
      </div>
      <p className="mt-2 text-sm text-muted">
        Credit left:{" "}
        <span className={`font-medium ${left <= 0 ? "text-danger" : "text-ink"}`}>{formatPaise(left)}</span>
        <span className="text-muted"> · prices from {timeAgo(snapshot.syncedAt)}</span>
      </p>
    </div>
  );
}

function Browse({ shop }: { shop: FieldShop }) {
  const { t } = useField();
  const { count, priced } = useCart();
  const { go } = useField();
  return (
    <>
      <CatalogueView t={t} />
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <button
            type="button"
            onClick={() => go(`#/shop/${encodeURIComponent(shop.id)}/cart`)}
            className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between rounded-xl bg-accent px-5 text-white hover:bg-accent-strong"
          >
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <ShoppingBag size={20} aria-hidden className="shrink-0" />
              <span className="truncate">
                {count} {count === 1 ? "item" : "items"} · Review order
              </span>
            </span>
            <span className="ml-3 shrink-0 text-lg font-semibold">{formatPaise(priced.totalPaise)}</span>
          </button>
        </div>
      )}
    </>
  );
}

function FieldCart({ shop }: { shop: FieldShop }) {
  const { snapshot, queue, lang, go, reloadQueue, syncNow, online } = useField();
  const { items, priced, setQty, clear, hydrated } = useCart();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  if (!hydrated) return <div className="min-h-64" aria-busy="true" />;

  const back = () => go(`#/shop/${encodeURIComponent(shop.id)}`);

  if (priced.lines.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <ShoppingBag size={40} aria-hidden className="text-muted" />
        <p className="mt-4 text-muted">Nothing in this order yet.</p>
        <div className="mt-6 w-full max-w-xs">
          <Button type="button" onClick={back}>
            Add products
          </Button>
        </div>
      </div>
    );
  }

  const left = creditLeftPaise(shop, unsentPaiseFor(queue, shop.id));
  const overCredit = priced.totalPaise > left;

  async function place() {
    setError(null);
    setBusy(true);
    try {
      const order = newQueuedOrder({
        id: crypto.randomUUID(),
        userId: snapshot.salesman.id,
        shopId: shop.id,
        shopName: shop.shopName,
        lines: priced.lines.map((l) => ({
          skuId: l.skuId,
          name: byId.get(l.skuId)?.name ?? l.skuId,
          qtyCases: l.qtyCases,
        })),
        note,
        priced,
      });
      // Saved on the phone first. It is safe even if the signal drops this second.
      await putOrder(order);
      clear();
      await reloadQueue();
      go("#/orders");
      if (online) void syncNow();
    } catch {
      setError("Could not save the order on this phone. Free some storage and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl lg:max-w-none">
      <h2 className="text-xl font-semibold tracking-tight">Review order</h2>
      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {priced.lines.map((line) => {
            const item = byId.get(line.skuId)!;
            const name = lang === "hi" && item.nameHi ? item.nameHi : item.name;
            const max = maxOrderableCases(item.stockCases, item.schemes);
            return (
              <li key={line.skuId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {line.qtyCases} {line.qtyCases === 1 ? "case" : "cases"} × {formatPaise(item.casePricePaise)}
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
                    <Trash2 size={16} aria-hidden /> Remove
                  </button>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  {line.freeCases > 0 && line.appliedScheme && (
                    <p className="font-medium text-accent">
                      +{line.freeCases} free · {schemeText(line.appliedScheme, lang)}
                    </p>
                  )}
                  {line.discountPaise > 0 && line.appliedScheme && (
                    <p className="font-medium text-accent">
                      −{formatPaise(line.discountPaise)} · {schemeText(line.appliedScheme, lang)}
                    </p>
                  )}
                  {line.nextBenefit && <p className="text-muted">{nextBenefitText(line.nextBenefit, lang, line.freeCases > 0)}</p>}
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="lg:sticky lg:top-40">
          <dl className="mt-5 space-y-2 rounded-2xl bg-surface p-4 text-[15px] lg:mt-0">
            <div className="flex justify-between">
              <dt className="text-muted">Items</dt>
              <dd>{formatPaise(priced.subtotalPaise)}</dd>
            </div>
            {priced.discountPaise > 0 && (
              <div className="flex justify-between text-accent">
                <dt>Scheme discount</dt>
                <dd>−{formatPaise(priced.discountPaise)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">GST</dt>
              <dd>{formatPaise(priced.gstPaise)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold">
              <dt>Total</dt>
              <dd>{formatPaise(priced.totalPaise)}</dd>
            </div>
          </dl>

          {overCredit && (
            <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
              This is {formatPaise(priced.totalPaise - left)} over the shop&apos;s credit. The order is still taken, but the office will hold it for approval.
            </p>
          )}

          <label htmlFor="note" className="mt-4 block text-sm font-medium text-muted">
            Note for the office (optional)
          </label>
          <input
            id="note"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-base focus:border-accent"
          />

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-4 space-y-2">
            <Button type="button" disabled={busy || priced.hasIssues} onClick={() => void place()}>
              {busy ? "Saving…" : online ? "Place order" : "Save order on this phone"}
            </Button>
            <Button type="button" variant="ghost" onClick={back}>
              Add more products
            </Button>
          </div>
          {!online && (
            <p className="mt-3 text-center text-sm text-muted">
              No connection. The order is saved here and sent to the office as soon as you are online.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
