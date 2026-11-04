import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import { DailySalesChart } from "@/components/desk/charts/daily-sales-chart";
import { RankedBars } from "@/components/desk/charts/ranked-bars";
import { SegmentedBar } from "@/components/desk/charts/segmented-bar";
import { requireDesk } from "@/lib/auth/dal";
import { formatPaise } from "@/lib/money";
import { loadSales } from "@/lib/orders/sales-data";
import { RANGES, formatCompactPaise, parseRange, pctChange, shareOf, shortDay } from "@/lib/sales";

/** A change against the period before. Direction is shown with an arrow and a sign, never colour alone. */
function Delta({ now, before, days }: { now: number; before: number; days: number }) {
  const change = pctChange(now, before);
  const label = days === 1 ? "yesterday" : `the previous ${days} days`;
  if (change === null) return <p className="mt-1 text-xs text-muted">No sales {days === 1 ? "yesterday" : "before"} to compare</p>;
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs">
      <span className={`flex items-center gap-0.5 font-semibold ${up ? "text-[#006300]" : "text-[#d03b3b]"}`}>
        <Icon size={14} aria-hidden />
        {up ? "+" : "−"}
        {Math.abs(Math.round(change * 100))}%
      </span>
      <span className="text-muted">vs {label}</span>
    </p>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {children}
    </div>
  );
}

export default async function SalesDashboard(props: PageProps<"/desk/dashboard">) {
  await requireDesk();
  const { range } = await props.searchParams;
  const key = parseRange(typeof range === "string" ? range : undefined);
  const s = await loadSales(key);
  const { current: c, previous: p, period } = s;

  const avg = c.orders ? Math.round(c.netPaise / c.orders) : 0;
  const prevAvg = p.orders ? Math.round(p.netPaise / p.orders) : 0;
  const best = s.daily.reduce((b, d) => (d.netPaise > b.netPaise ? d : b), s.daily[0]);
  const channelOrders = s.channels.ai.orders + s.channels.catalogue.orders;
  const aiShare = Math.round(shareOf(s.channels.ai.orders, channelOrders) * 100);
  const rangeLabel = RANGES.find((r) => r.key === key)!.label.toLowerCase();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales dashboard</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Sales are orders the desk has confirmed or exported, by the day the shop ordered (Indian time), after
            scheme discounts and before GST.
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Date range">
          {RANGES.map((r) => {
            const active = r.key === key;
            return (
              <Link
                key={r.key}
                href={r.key === "30" ? "/desk/dashboard" : `/desk/dashboard?range=${r.key}`}
                role="tab"
                aria-selected={active}
                className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                  active ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* the one number the page leads with, then the figures behind it */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="hero" className="rounded-2xl border border-line p-6 lg:col-span-1">
          <h2 id="hero" className="text-sm text-muted">
            Net sales, {rangeLabel}
          </h2>
          <p className="mt-2 text-5xl font-semibold tracking-tight">{formatCompactPaise(c.netPaise)}</p>
          <p className="mt-2 text-sm text-muted tabular-nums">{formatPaise(c.netPaise)}</p>
          <Delta now={c.netPaise} before={p.netPaise} days={period.days} />
        </section>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2 xl:grid-cols-3">
          <Tile label="Orders" value={String(c.orders)}>
            <Delta now={c.orders} before={p.orders} days={period.days} />
          </Tile>
          <Tile label="Average order" value={formatCompactPaise(avg)}>
            <Delta now={avg} before={prevAvg} days={period.days} />
          </Tile>
          <Tile label="Billed incl. GST" value={formatCompactPaise(c.totalPaise)}>
            <p className="mt-1 text-xs text-muted">GST {formatCompactPaise(c.gstPaise)}</p>
          </Tile>
          <Tile label="Scheme discounts given" value={formatCompactPaise(c.discountPaise)}>
            <p className="mt-1 text-xs text-muted">{c.freeCases} free {c.freeCases === 1 ? "case" : "cases"} on top</p>
          </Tile>
          <Tile label="Cases sold" value={c.cases.toLocaleString("en-IN")}>
            <Delta now={c.cases} before={p.cases} days={period.days} />
          </Tile>
          <Tile label="Waiting for the desk" value={formatCompactPaise(s.waiting.totalPaise)}>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <Clock size={12} aria-hidden />
              {s.waiting.orders} {s.waiting.orders === 1 ? "order" : "orders"}
              {s.waiting.onHold > 0 && `, ${s.waiting.onHold} on hold`}
            </p>
          </Tile>
        </div>
      </div>

      <section aria-labelledby="daily" className="mt-6 rounded-2xl border border-line p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="daily" className="text-lg font-semibold">
            Net sales per day
          </h2>
          {best && best.netPaise > 0 && (
            <p className="text-sm text-muted">
              Best day: {shortDay(best.day)} · {formatCompactPaise(best.netPaise)}
            </p>
          )}
        </div>
        {c.orders === 0 ? (
          <p className="py-16 text-center text-muted">
            No confirmed sales in this period yet. Orders appear here once the desk confirms them.
          </p>
        ) : (
          <DailySalesChart points={s.daily} />
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="products" className="rounded-2xl border border-line p-5">
          <h2 id="products" className="text-lg font-semibold">
            Top products
          </h2>
          <p className="mb-4 text-sm text-muted">By net sales, {rangeLabel}</p>
          {s.topProducts.length === 0 ? (
            <p className="py-8 text-center text-muted">Nothing sold in this period.</p>
          ) : (
            <RankedBars
              rows={s.topProducts.map((r) => ({
                label: r.name,
                detail: `${r.cases} ${r.cases === 1 ? "case" : "cases"}${r.freeCases ? ` + ${r.freeCases} free` : ""}`,
                value: r.netPaise,
                valueLabel: formatCompactPaise(r.netPaise),
              }))}
            />
          )}
        </section>

        <section aria-labelledby="shops" className="rounded-2xl border border-line p-5">
          <h2 id="shops" className="text-lg font-semibold">
            Top shops
          </h2>
          <p className="mb-4 text-sm text-muted">By net sales, {rangeLabel}</p>
          {s.topShops.length === 0 ? (
            <p className="py-8 text-center text-muted">No shop ordered in this period.</p>
          ) : (
            <RankedBars
              rows={s.topShops.map((r) => ({
                label: r.shopName,
                detail: `${r.city} · ${r.orders} ${r.orders === 1 ? "order" : "orders"}`,
                value: r.netPaise,
                valueLabel: formatCompactPaise(r.netPaise),
              }))}
            />
          )}
        </section>
      </div>

      <section aria-labelledby="channel" className="mt-6 rounded-2xl border border-line p-5">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
          <div>
            <h2 id="channel" className="text-lg font-semibold">
              How orders arrive
            </h2>
            <p className="mb-4 text-sm text-muted">
              Every order placed in this period that was not cancelled. An order from a pasted message counts here as
              soon as it is placed.
            </p>
            <SegmentedBar
              segments={[
                { name: "Catalogue", value: s.channels.catalogue.orders, color: "var(--viz-1)" },
                { name: "From a message (AI)", value: s.channels.ai.orders, color: "var(--viz-2)" },
              ]}
            />
          </div>
          <div className="text-sm">
            <p className="text-3xl font-semibold tracking-tight">{channelOrders ? `${aiShare}%` : "–"}</p>
            <p className="text-muted">
              of orders came from a pasted message ({s.channels.ai.orders} of {channelOrders}).
            </p>
            <p className="mt-2 text-muted">
              The client&apos;s goal is that half of all orders are placed in the app or captured by AI within four
              months, and that wrong-item orders fall from 5% to under 1%.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
