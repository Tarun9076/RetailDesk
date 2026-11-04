"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";
import { paiseToInput, parseRupees } from "@/lib/catalogue-admin/rules";
import { formatPaise } from "@/lib/money";
import { card, hint, input, label, primaryBtn, secondaryBtn } from "./styles";

export interface ShopPriceRow {
  retailerId: string;
  shopName: string;
  city: string;
  pricePaise: number;
}

export function ShopPricesPanel({
  skuId,
  dealerPaise,
  prices,
  shops,
}: {
  skuId: string;
  dealerPaise: number;
  prices: ShopPriceRow[];
  /** Shops that do not have their own price yet. */
  shops: { id: string; shopName: string; city: string }[];
}) {
  const router = useRouter();
  const [shopId, setShopId] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(retailerId: string, text: string, key: string) {
    setError(null);
    const paise = parseRupees(text);
    if (paise === null) return setError("Enter the price per piece in rupees, for example 7.90.");
    setBusy(key);
    try {
      const res = await fetch(`/api/desk/products/${skuId}/prices/${retailerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePaise: paise }),
      });
      if (!res.ok) throw new Error("failed");
      setShopId("");
      setPrice("");
      setEditing(null);
      router.refresh();
    } catch {
      setError("Could not save the price. Please try again.");
    }
    setBusy(null);
  }

  async function remove(retailerId: string) {
    setError(null);
    setBusy(`rm-${retailerId}`);
    try {
      const res = await fetch(`/api/desk/products/${skuId}/prices/${retailerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError("Could not remove the price. Please try again.");
    }
    setBusy(null);
  }

  const diff = (p: number) => {
    const d = p - dealerPaise;
    return d === 0 ? "same as dealer price" : `${d < 0 ? "−" : "+"}${formatPaise(Math.abs(d))} per piece vs dealer`;
  };

  return (
    <section className={card} aria-labelledby="shop-prices-title">
      <h2 id="shop-prices-title" className="text-lg font-semibold">Shop prices</h2>
      <p className="mt-1 text-sm text-muted">
        Every shop pays the dealer price ({formatPaise(dealerPaise)} per piece) unless it has its own price here. Only that shop,
        its salesman and the desk can see it.
      </p>

      {prices.length === 0 ? (
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted">No shop has its own price for this product.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {prices.map((p) => (
            <li key={p.retailerId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{p.shopName}</p>
                <p className="text-xs text-muted">{p.city}</p>
              </div>
              {editing === p.retailerId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`New price for ${p.shopName}`}
                    inputMode="decimal"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="min-h-11 w-28 rounded-xl border border-line bg-bg px-3 text-base focus:border-accent"
                  />
                  <button type="button" disabled={busy !== null} onClick={() => void save(p.retailerId, editPrice, `ed-${p.retailerId}`)} className={secondaryBtn}>
                    {busy === `ed-${p.retailerId}` ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className={secondaryBtn}>Cancel</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-right">
                    <span className="font-semibold">{formatPaise(p.pricePaise)}</span>
                    <span className="block text-xs text-muted">{diff(p.pricePaise)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p.retailerId);
                      setEditPrice(paiseToInput(p.pricePaise));
                    }}
                    className={secondaryBtn}
                  >
                    Change
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => void remove(p.retailerId)} className={secondaryBtn}>
                    {busy === `rm-${p.retailerId}` ? "Removing…" : "Use dealer price"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {shops.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!shopId) return setError("Pick a shop.");
            void save(shopId, price, "add");
          }}
          className="mt-6 border-t border-line pt-5"
        >
          <h3 className="font-semibold">Give a shop its own price</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div>
              <label htmlFor="sp-shop" className={label}>Shop</label>
              <select id="sp-shop" value={shopId} onChange={(e) => setShopId(e.target.value)} className={input}>
                <option value="">Choose a shop</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shopName} · {s.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sp-price" className={label}>Price per piece (₹)</label>
              <input id="sp-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={paiseToInput(dealerPaise)} className={input} />
            </div>
          </div>
          <p className={hint}>GST is added on top, as for every price.</p>
          <button type="submit" disabled={busy !== null} className={`${primaryBtn} mt-4`}>
            {busy === "add" ? "Saving…" : "Save shop price"}
          </button>
        </form>
      )}
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </section>
  );
}
