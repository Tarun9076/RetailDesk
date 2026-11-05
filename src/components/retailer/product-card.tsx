"use client";

import { Check, Tag } from "lucide-react";
import { LOW_STOCK_CASES, type CatalogueItem } from "@/lib/catalogue-types";
import { fmt, plural, type Dict } from "@/lib/i18n/dict";
import { nextBenefitText, schemeText } from "@/lib/i18n/scheme";
import { formatBp, formatPaise, formatPriceShort } from "@/lib/money";
import { splitProductName } from "@/lib/product-look";
import { maxOrderableCases } from "@/lib/pricing/engine";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";
import { QtyStepper } from "./qty-stepper";

/**
 * One product. The picture is large and the price is the loudest thing in the card; everything a
 * shopkeeper must know (GST, scheme, stock) is there in one short line each, and nothing else is.
 */
export function ProductCard({ item, t }: { item: CatalogueItem; t: Dict["catalogue"] }) {
  const { lang, qty, setQty, lineFor } = useCart();
  const n = qty[item.id] ?? 0;
  const line = lineFor(item.id);
  const out = item.stockCases === 0;
  const low = !out && item.stockCases <= LOW_STOCK_CASES;
  const max = maxOrderableCases(item.stockCases, item.schemes);
  const name = lang === "hi" && item.nameHi ? item.nameHi : item.name;
  const { title } = splitProductName(name);

  return (
    <article className="flex flex-col" aria-label={title}>
      <ProductImage name={item.name} brand={item.brand} imageUrl={item.imageUrl} dim={out} />

      <div className="mt-3 flex flex-1 flex-col">
        {/* The price comes first, straight under the picture, so prices line up across a row and can be compared at a glance. */}
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-xl font-semibold tracking-tight tabular-nums">{formatPriceShort(item.casePricePaise)}</span>
          <span className="text-xs text-muted">{t.perCase}</span>
        </p>
        <h2 className="mt-1 line-clamp-2 text-[15px] font-medium leading-5">{title}</h2>
        {/* GST is always stated, never implied: "+18% GST extra", or "No GST". */}
        <p className="mt-1 text-xs leading-4 text-muted">
          {item.gstRateBp > 0 ? fmt(t.gstExtra, { rate: formatBp(item.gstRateBp) }) : t.noGst}
        </p>
        <p className="text-xs leading-4 text-muted">{fmt(t.perPiece, { price: formatPaise(item.unitPricePaise), n: item.piecesPerCase })}</p>

        {item.schemes.map((s) => (
          <p key={schemeText(s, "en")} className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-4 text-accent">
            <Tag size={12} aria-hidden className="mt-0.5 shrink-0" />
            {schemeText(s, lang)}
          </p>
        ))}

        {(out || low) && (
          <p className={`mt-1.5 text-xs font-medium ${out ? "text-danger" : "text-amber-800"}`}>
            {out ? t.outOfStock : fmt(plural(item.stockCases, t.lowStockOne, t.lowStock), { n: item.stockCases })}
          </p>
        )}

        <div className="mt-auto pt-3">
          {out ? null : n === 0 ? (
            <button
              type="button"
              onClick={() => setQty(item.id, 1)}
              className="min-h-12 w-full rounded-xl border border-accent bg-bg px-4 text-base font-medium text-accent transition-colors hover:bg-accent-soft active:bg-accent-soft"
            >
              {t.add}
            </button>
          ) : (
            <>
              <QtyStepper value={n} max={max} onChange={(v) => setQty(item.id, v)} label={title} compact />
              <div className="mt-2 space-y-0.5 text-xs leading-4">
                {line && (line.freeCases > 0 || line.discountPaise > 0) && (
                  <p className="flex items-center gap-1 font-medium text-accent">
                    <Check size={13} aria-hidden />
                    {line.freeCases > 0 && `${fmt(t.freeCases, { n: line.freeCases })} ${line.freeCases === 1 ? t.caseOne : t.cases}`}
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
      </div>
    </article>
  );
}
