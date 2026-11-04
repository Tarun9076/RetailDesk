"use client";

import { useId, useMemo, useRef, useState } from "react";
import { formatPaise } from "@/lib/money";
import { formatCompactPaise, niceScale, shortDay, type DayPoint } from "@/lib/sales";

const PLOT_HEIGHT = 240;

/**
 * Net sales per day as columns. One series, so no legend box: the card's title
 * names it. Hover or arrow keys show the day; a table view is one click away.
 */
export function DailySalesChart({ points }: { points: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const plot = useRef<HTMLDivElement>(null);
  const tableId = useId();

  const n = points.length;
  const max = Math.max(0, ...points.map((p) => p.netPaise));
  const scale = useMemo(() => niceScale(max), [max]);

  // About seven labels along the bottom, whatever the range.
  const every = Math.max(1, Math.ceil(n / 7));

  function indexAt(clientX: number): number | null {
    const box = plot.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return Math.min(n - 1, Math.max(0, Math.floor(((clientX - box.left) / box.width) * n)));
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (step) setActive((a) => Math.min(n - 1, Math.max(0, (a ?? (step > 0 ? -1 : n)) + step)));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const a = active !== null ? points[active] : null;
  // Keep the tooltip inside the chart near either edge.
  const tipLeft = active !== null ? Math.min(86, Math.max(14, ((active + 0.5) / n) * 100)) : 0;

  return (
    <div className="viz">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          aria-controls={tableId}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>

      {asTable ? (
        <div id={tableId} className="max-h-80 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">Orders</th>
                <th className="px-4 py-2.5 text-right font-medium">Net sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...points].reverse().map((p) => (
                <tr key={p.day}>
                  <td className="px-4 py-2">{shortDay(p.day)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.orders}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.netPaise ? formatPaise(p.netPaise) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div id={tableId} className="flex gap-2">
          {/* y axis */}
          <div className="relative w-14 shrink-0 text-right text-xs text-[var(--viz-muted)]" style={{ height: PLOT_HEIGHT }} aria-hidden>
            {scale.ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2 tabular-nums"
                style={{ bottom: `${(t / scale.max) * 100}%` }}
              >
                {t === 0 ? "0" : formatCompactPaise(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div
              ref={plot}
              tabIndex={0}
              role="group"
              aria-label={`Net sales for each of the last ${n} ${n === 1 ? "day" : "days"}. Use the left and right arrow keys to read each day.`}
              onMouseMove={(e) => setActive(indexAt(e.clientX))}
              onMouseLeave={() => setActive(null)}
              onTouchStart={(e) => setActive(indexAt(e.touches[0].clientX))}
              onTouchMove={(e) => setActive(indexAt(e.touches[0].clientX))}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              className="relative cursor-crosshair rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{ height: PLOT_HEIGHT, touchAction: "pan-y" }}
            >
              {/* hairline gridlines, behind the bars */}
              {scale.ticks.map((t) => (
                <div
                  key={t}
                  aria-hidden
                  className="absolute inset-x-0"
                  style={{
                    bottom: `${(t / scale.max) * 100}%`,
                    borderTop: `1px solid ${t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"}`,
                  }}
                />
              ))}

              {/* columns: <= 24px thick, rounded data end, square at the baseline, 2px gap */}
              <div className="absolute inset-0 flex items-end gap-[2px]" aria-hidden>
                {points.map((p, i) => (
                  <div key={p.day} className="flex h-full flex-1 items-end justify-center">
                    <div
                      className="w-full max-w-6 rounded-t-[4px]"
                      style={{
                        height: `${(p.netPaise / scale.max) * 100}%`,
                        background: "var(--viz-1)",
                        opacity: active === null || active === i ? 1 : 0.45,
                      }}
                    />
                  </div>
                ))}
              </div>

              {a && (
                <>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-px bg-[var(--viz-muted)]/50"
                    style={{ left: `${((active! + 0.5) / n) * 100}%` }}
                  />
                  <div
                    role="status"
                    className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-line bg-bg px-3 py-2 text-sm shadow-lg"
                    style={{ left: `${tipLeft}%`, top: -4, transform: "translate(-50%, -100%)" }}
                  >
                    <p className="font-medium">{shortDay(a.day)}</p>
                    <p className="tabular-nums">{a.netPaise ? formatPaise(a.netPaise) : "No sales"}</p>
                    <p className="text-xs text-muted">
                      {a.orders} {a.orders === 1 ? "order" : "orders"}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* x axis */}
            <div className="relative mt-2 h-5 text-xs text-[var(--viz-muted)]" aria-hidden>
              {points.map((p, i) =>
                i % every === 0 ? (
                  <span
                    key={p.day}
                    className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${((i + 0.5) / n) * 100}%` }}
                  >
                    {shortDay(p.day)}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
