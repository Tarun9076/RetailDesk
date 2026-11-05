import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/desk/catalogue/product-form";
import { SchemePanel } from "@/components/desk/catalogue/scheme-panel";
import { ShopPricesPanel } from "@/components/desk/catalogue/shop-prices-panel";
import { StockPanel } from "@/components/desk/catalogue/stock-panel";
import { requireDesk } from "@/lib/auth/dal";
import { schemeStatus, toIstDateInput } from "@/lib/catalogue-admin/rules";
import { compareSchemes } from "@/lib/pricing/engine";
import { toRule } from "@/lib/catalogue";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

const KIND: Record<string, string> = {
  PRODUCT_CREATED: "Added",
  PRODUCT_UPDATED: "Edited",
  STOCK_ADJUSTED: "Stock",
  SCHEME_ADDED: "Scheme",
  SCHEME_CHANGED: "Scheme",
  SCHEME_REMOVED: "Scheme",
  SHOP_PRICE_SET: "Shop price",
  SHOP_PRICE_REMOVED: "Shop price",
};

export default async function ProductPage(props: PageProps<"/desk/catalogue/[id]">) {
  await requireDesk();
  const { id } = await props.params;
  const { added } = await props.searchParams;

  const sku = await db.sku.findUnique({
    where: { id },
    include: {
      schemes: true,
      retailerPrice: { include: { retailer: { select: { shopName: true, city: true } } } },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!sku) notFound();

  const [brands, allShops] = await Promise.all([
    db.sku.findMany({ distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
    db.retailer.findMany({ select: { id: true, shopName: true, city: true }, orderBy: { shopName: "asc" } }),
  ]);

  const now = new Date();
  // Same fixed order the shoppers' catalogue uses; rows that are not valid rules are skipped, never guessed at.
  const schemes = sku.schemes
    .map((s) => ({ row: s, rule: toRule(s) }))
    .filter((x): x is { row: (typeof sku.schemes)[number]; rule: NonNullable<ReturnType<typeof toRule>> } => x.rule !== null)
    .sort((a, b) => compareSchemes(a.rule, b.rule))
    .map(({ row }) => ({
      id: row.id,
      label: row.label,
      status: schemeStatus({ ...row, type: row.type }, now),
      from: toIstDateInput(row.validFrom),
      until: toIstDateInput(row.validUntil),
    }));

  const haveOwn = new Set(sku.retailerPrice.map((p) => p.retailerId));
  const prices = sku.retailerPrice
    .map((p) => ({ retailerId: p.retailerId, shopName: p.retailer.shopName, city: p.retailer.city, pricePaise: p.pricePaise }))
    .sort((a, b) => a.shopName.localeCompare(b.shopName));

  return (
    <div>
      <Link href="/desk/catalogue" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Catalogue
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{sku.name}</h1>
        {!sku.active && <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">Off sale</span>}
      </div>
      <p className="text-sm text-muted">{sku.code} · {sku.brand}</p>

      {added && (
        <p role="status" className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          Product added. Now set its stock, and add any schemes below.
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <ProductForm
            mode="edit"
            brands={brands.map((b) => b.brand)}
            initial={{
              id: sku.id,
              code: sku.code,
              name: sku.name,
              nameHi: sku.nameHi ?? "",
              imageUrl: sku.imageUrl ?? "",
              brand: sku.brand,
              piecesPerCase: sku.piecesPerCase,
              pricePaise: sku.pricePaise,
              gstRateBp: sku.gstRateBp,
              active: sku.active,
            }}
          />
          <StockPanel skuId={sku.id} stock={sku.stockCases} />
        </div>
        <div className="space-y-6">
          <SchemePanel skuId={sku.id} schemes={schemes} />
          <ShopPricesPanel
            skuId={sku.id}
            dealerPaise={sku.pricePaise}
            prices={prices}
            shops={allShops.filter((s) => !haveOwn.has(s.id))}
          />
        </div>
      </div>

      <section aria-labelledby="history" className="mt-6 rounded-2xl border border-line p-5">
        <h2 id="history" className="text-lg font-semibold">History</h2>
        {sku.events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No changes recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {sku.events.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="w-28 shrink-0 text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-muted">{KIND[e.kind] ?? e.kind}</span>
                <span className="min-w-0 flex-1 text-sm">{e.summary}</span>
                <span className="shrink-0 text-xs text-muted">{e.byName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
