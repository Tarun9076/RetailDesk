"use client";

import { Check } from "lucide-react";
import { LOW_STOCK_CASES, type CatalogueItem } from "@/lib/catalogue-types";
import { fmt, plural, type Dict } from "@/lib/i18n/dict";
import { nextBenefitText, schemeText } from "@/lib/i18n/scheme";
import { formatBp, formatPaise } from "@/lib/money";
import { maxOrderableCases } from "@/lib/pricing/engine";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";
import { QtyStepper } from "./qty-stepper";

export function ProductCard({ item, t }: { item: CatalogueItem; t: Dict["catalogue"] }) {
  const { lang, qty, setQty, lineFor } = useCart();
  const n = qty[item.id] ?? 0;
  const line = lineFor(item.id);
  const out = item.stockCases === 0;
  const low = !out && item.stockCases <= LOW_STOCK_CASES;
  const max = maxOrderableCases(item.stockCases, item.scheme);
  const name = lang === "hi" && item.nameHi ? item.nameHi : item.name;

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-bg p-3">
      <ProductImage name={item.name} brand={item.brand} dim={out} />

      <h2 className="mt-3 line-clamp-2 min-h-[2.75rem] text-[15px] font-medium leading-snug">{name}</h2>

      <p className="mt-1 text-xl font-semibold">{formatPaise(item.casePricePaise)}</p>
      <p className="text-xs font-medium text-muted">
        {t.perCase} · {t.exclGst}
      </p>
      <p className="text-xs text-muted">
        {item.gstRateBp > 0 ? fmt(t.gstExtra, { rate: formatBp(item.gstRateBp) }) : t.noGst}
      </p>
      <p className="text-xs text-muted">
        {fmt(t.perPiece, { price: formatPaise(item.unitPricePaise), n: item.piecesPerCase })}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.scheme && (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
            {schemeText(item.scheme, lang)}
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            out ? "bg-danger-soft text-danger" : low ? "bg-amber-50 text-amber-800" : "bg-surface text-muted"
          }`}
        >
          {out
            ? t.outOfStock
            : low
              ? fmt(plural(item.stockCases, t.lowStockOne, t.lowStock), { n: item.stockCases })
              : t.inStock}
        </span>
      </div>

      <div className="mt-auto pt-3">
        {out ? null : n === 0 ? (
          <button
            type="button"
            onClick={() => setQty(item.id, 1)}
            className="min-h-12 w-full rounded-xl bg-accent px-4 text-base font-medium text-white hover:bg-accent-strong"
          >
            {t.add}
          </button>
        ) : (
          <>
            <QtyStepper value={n} max={max} onChange={(v) => setQty(item.id, v)} label={name} />
            <div className="mt-2 space-y-1 text-xs">
              {line && (line.freeCases > 0 || line.discountPaise > 0) && (
                <p className="flex items-center gap-1 font-medium text-accent">
                  <Check size={14} aria-hidden />
                  {line.freeCases > 0 && `${fmt(t.freeCases, { n: line.freeCases })} ${t.cases}`}
                  {line.discountPaise > 0 && `−${formatPaise(line.discountPaise)}`}
                </p>
              )}
              {n >= max ? (
                <p className="text-amber-800">{fmt(t.maxAvailable, { n: max })}</p>
              ) : (
                line?.nextBenefit && (
                  <p className="text-muted">{nextBenefitText(line.nextBenefit, lang, (line.freeCases ?? 0) > 0)}</p>
                )
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
