"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Dict } from "@/lib/i18n/dict";
import { useCart } from "./cart-provider";
import { ProductCard } from "./product-card";

export function CatalogueView({ t }: { t: Dict["catalogue"] }) {
  const { items, lang } = useCart();
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);

  const brands = useMemo(() => [...new Set(items.map((i) => i.brand))], [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!brand || i.brand === brand) &&
        (!q || `${i.name} ${i.nameHi ?? ""} ${i.code} ${i.brand}`.toLowerCase().includes(q)),
    );
  }, [items, query, brand]);

  // The chosen filter is dark, the rest are quiet: green is kept for the things you act on.
  const chip = (active: boolean) =>
    `min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
      active ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink"
    }`;

  return (
    <div>
      <div className="relative">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          aria-label={t.search}
          lang={lang}
          className="min-h-12 w-full rounded-2xl border border-transparent bg-surface pl-11 pr-4 text-base placeholder:text-muted focus:border-accent focus:bg-bg"
        />
      </div>

      {brands.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group">
          <button type="button" className={chip(brand === null)} onClick={() => setBrand(null)}>
            {t.all}
          </button>
          {brands.map((b) => (
            <button key={b} type="button" className={chip(brand === b)} onClick={() => setBrand(b)}>
              {b}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-20 text-center text-muted">{t.empty}</p>
      ) : (
        // Two products across on a phone, so each picture is large; more as the screen grows.
        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <ProductCard key={item.id} item={item} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
