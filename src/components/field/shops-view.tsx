"use client";

import { ChevronRight, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { daysSince } from "@/lib/field/ago";
import { creditLeftPaise } from "@/lib/field/types";
import { unsentPaiseFor } from "@/lib/field/queue";
import { formatPaise } from "@/lib/money";
import { useField } from "./field-context";

const QUIET_DAYS = 14;

function lastOrderText(days: number | null): string {
  if (days === null) return "Never ordered";
  if (days === 0) return "Ordered today";
  return `${days} ${days === 1 ? "day" : "days"} since last order`;
}

export function ShopsView() {
  const { snapshot, queue, go } = useField();
  const [query, setQuery] = useState("");
  const [onlyQuiet, setOnlyQuiet] = useState(false);

  const rows = useMemo(() => {
    const now = new Date();
    return snapshot.shops.map((s) => {
      // An order taken today and still on the phone counts as an order: the shop is not quiet any more.
      const unsentFor = queue.filter((o) => o.shopId === s.id && o.status !== "needs_attention");
      const days = unsentFor.length > 0 ? 0 : daysSince(s.lastOrderAt, now);
      return {
        shop: s,
        days,
        unsentCount: unsentFor.filter((o) => o.status === "pending" || o.status === "sending").length,
        left: creditLeftPaise(s, unsentPaiseFor(queue, s.id)),
      };
    });
  }, [snapshot.shops, queue]);

  const quiet = rows.filter((r) => r.days === null || r.days >= QUIET_DAYS).length;
  const q = query.trim().toLowerCase();
  const visible = rows
    .filter((r) => (!onlyQuiet || r.days === null || r.days >= QUIET_DAYS))
    .filter((r) => !q || `${r.shop.shopName} ${r.shop.ownerName} ${r.shop.city}`.toLowerCase().includes(q))
    // The shops that most need a visit come first.
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));

  const chip = (active: boolean) =>
    `min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${
      active ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
    }`;

  if (snapshot.shops.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Store size={40} aria-hidden className="text-muted" />
        <h1 className="mt-4 text-xl font-semibold">No shops assigned yet</h1>
        <p className="mt-2 max-w-sm text-muted">The office assigns shops to you. Once they do, they appear here after the next sync.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My shops</h1>
      <p className="mt-1 text-sm text-muted">
        {snapshot.shops.length} {snapshot.shops.length === 1 ? "shop" : "shops"}
        {quiet > 0 && ` · ${quiet} without an order in ${QUIET_DAYS}+ days`}
      </p>

      <div className="relative mt-4">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shop, owner or area"
          aria-label="Search shops"
          className="min-h-12 w-full rounded-xl border border-line bg-bg pl-11 pr-4 text-base placeholder:text-muted/70 focus:border-accent"
        />
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter">
        <button type="button" className={chip(!onlyQuiet)} onClick={() => setOnlyQuiet(false)}>
          All shops
        </button>
        <button type="button" className={chip(onlyQuiet)} onClick={() => setOnlyQuiet(true)}>
          Visit first ({quiet})
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-muted">No shop matches.</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ shop, days, unsentCount, left }) => {
            const quietShop = days === null || days >= QUIET_DAYS;
            return (
              <li key={shop.id}>
                <button
                  type="button"
                  onClick={() => go(`#/shop/${encodeURIComponent(shop.id)}`)}
                  className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-line bg-bg p-4 text-left hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{shop.shopName}</p>
                    <p className="truncate text-sm text-muted">
                      {shop.ownerName} · {shop.city}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className={quietShop ? "font-medium text-amber-800" : "text-muted"}>{lastOrderText(days)}</span>
                      <span className={left <= 0 ? "font-medium text-danger" : "text-muted"}>
                        · credit left {formatPaise(left)}
                      </span>
                      {unsentCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                          {unsentCount} to send
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
