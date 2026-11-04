export interface RankedRow {
  label: string;
  detail: string; // a quiet second line: cases, orders
  value: number;
  valueLabel: string;
}

/**
 * A ranked list of horizontal bars. Bars grow from one baseline, are 10px thick
 * with a rounded tip, and the value sits at the tip, so nothing needs a legend.
 */
export function RankedBars({ rows }: { rows: RankedRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="viz space-y-4">
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={r.label}>
              <span className="mr-2 text-muted tabular-nums">{i + 1}</span>
              {r.label}
            </p>
            <p className="truncate pl-5 text-xs text-muted">{r.detail}</p>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {/* leave room after the bar for its value */}
            <div className="min-w-0 flex-1">
              <div
                className="h-2.5 rounded-r-[4px]"
                style={{
                  width: `${Math.max(1.5, (r.value / max) * 100)}%`,
                  background: "var(--viz-1)",
                }}
                role="presentation"
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums">{r.valueLabel}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
