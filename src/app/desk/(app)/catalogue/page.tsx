import { Package } from "lucide-react";
import Link from "next/link";
import { requireDesk } from "@/lib/auth/dal";
import { schemeStatus } from "@/lib/catalogue-admin/rules";
import { LOW_STOCK_CASES } from "@/lib/catalogue-types";
import { db } from "@/lib/db";
import { formatBp, formatPaise } from "@/lib/money";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
  { key: "off", label: "Off sale" },
] as const;

const GRID = "lg:grid lg:grid-cols-[minmax(0,2fr)_8rem_8rem_6rem_6rem_minmax(0,1.6fr)]";

export default async function CataloguePage(props: PageProps<"/desk/catalogue">) {
  await requireDesk();
  const { show, q } = await props.searchParams;
  const filter = FILTERS.find((f) => f.key === show) ?? FILTERS[0];
  const query = (typeof q === "string" ? q : "").trim();
  const now = new Date();

  const skus = await db.sku.findMany({
    include: { schemes: true },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
  });

  const onSale = skus.filter((s) => s.active);
  const counts = {
    onSale: onSale.length,
    low: onSale.filter((s) => s.stockCases > 0 && s.stockCases <= LOW_STOCK_CASES).length,
    out: onSale.filter((s) => s.stockCases === 0).length,
    off: skus.length - onSale.length,
  };

  const needle = query.toLowerCase();
  const list = skus
    .filter((s) => {
      if (filter.key === "low") return s.active && s.stockCases > 0 && s.stockCases <= LOW_STOCK_CASES;
      if (filter.key === "out") return s.active && s.stockCases === 0;
      if (filter.key === "off") return !s.active;
      return true;
    })
    .filter((s) => !needle || `${s.name} ${s.nameHi ?? ""} ${s.code} ${s.brand}`.toLowerCase().includes(needle));

  const stat = (text: string, n: number, tone: string) => (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-sm text-muted">{text}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{n}</p>
    </div>
  );
  const href = (key: string) => `/desk/catalogue?${new URLSearchParams({ ...(key !== "all" ? { show: key } : {}), ...(query ? { q: query } : {}) })}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Products, dealer prices, stock and schemes. Changes reach shopkeepers on their next screen and salesmen on their
            next sync. Every change is recorded with your name.
          </p>
        </div>
        <Link href="/desk/catalogue/new" className="flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong">
          Add a product
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("On sale", counts.onSale, "text-accent")}
        {stat(`Low stock (${LOW_STOCK_CASES} cases or fewer)`, counts.low, "text-amber-700")}
        {stat("Out of stock", counts.out, "text-danger")}
        {stat("Off sale", counts.off, "text-muted")}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="tablist">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href(f.key)}
              role="tab"
              aria-selected={f.key === filter.key}
              className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                f.key === filter.key ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form action="/desk/catalogue" className="ml-auto flex gap-2">
          {filter.key !== "all" && <input type="hidden" name="show" value={filter.key} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search name, code or brand"
            aria-label="Search products"
            className="min-h-11 w-64 max-w-full rounded-xl border border-line bg-bg px-4 text-sm focus:border-accent"
          />
          <button type="submit" className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface">
            Search
          </button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Package size={40} aria-hidden className="text-muted" />
          <p className="mt-4 text-muted">No products match.</p>
        </div>
      ) : (
        <div className="mt-4 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-line">
          <div className={`hidden bg-surface px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted lg:gap-4 ${GRID}`}>
            <span>Product</span>
            <span className="text-right">Per piece</span>
            <span className="text-right">Per case</span>
            <span>GST</span>
            <span className="text-right">Stock</span>
            <span>Schemes</span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 lg:block lg:divide-y lg:divide-line">
            {list.map((s) => {
              const live = s.schemes.filter((x) => schemeStatus({ ...x, type: x.type, buyQty: x.buyQty, freeQty: x.freeQty, minQty: x.minQty, percentBp: x.percentBp }, now) === "live");
              const stockTone = s.stockCases === 0 ? "text-danger" : s.stockCases <= LOW_STOCK_CASES ? "text-amber-700" : "text-ink";
              return (
                <li key={s.id} className="overflow-hidden rounded-2xl border border-line lg:rounded-none lg:border-0">
                  <Link href={`/desk/catalogue/${s.id}`} className={`flex flex-col gap-1.5 px-4 py-4 hover:bg-surface sm:px-5 ${GRID} lg:items-center lg:gap-4`}>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="truncate">{s.name}</span>
                        {!s.active && <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">Off sale</span>}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {s.code} · {s.brand} · {s.piecesPerCase} pcs/case
                      </span>
                    </span>
                    <span className="text-sm lg:text-right">{formatPaise(s.pricePaise)}</span>
                    <span className="text-sm lg:text-right">{formatPaise(s.pricePaise * s.piecesPerCase)}</span>
                    <span className="text-sm text-muted">{s.gstRateBp === 0 ? "None" : formatBp(s.gstRateBp)}</span>
                    <span className={`text-sm font-semibold lg:text-right ${stockTone}`}>
                      {s.stockCases} {s.stockCases === 0 ? "· out" : s.stockCases <= LOW_STOCK_CASES ? "· low" : ""}
                    </span>
                    <span className="text-sm text-muted">
                      {live.length === 0 ? "None" : live.map((x) => x.label).join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
