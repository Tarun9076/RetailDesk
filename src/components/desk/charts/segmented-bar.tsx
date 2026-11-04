export interface Segment {
  name: string;
  value: number;
  color: string; // a CSS variable such as var(--viz-1)
}

/**
 * One whole split into parts. Widths are proportional; each block carries its
 * share in white when it is wide enough to hold it. The legend names the parts
 * in block order and repeats no numbers, which live in the text beside the chart.
 */
export function SegmentedBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const label = segments.map((s) => `${s.name} ${total ? Math.round((s.value / total) * 100) : 0}%`).join(", ");

  return (
    <div className="viz">
      <div className="flex h-7 gap-[2px]" role="img" aria-label={`Share of orders: ${label}`}>
        {total === 0 ? (
          <div className="h-full w-full rounded bg-[var(--viz-grid)]" />
        ) : (
          segments
            .filter((s) => s.value > 0) // a part at zero draws nothing
            .map((s) => {
              const pct = (s.value / total) * 100;
              return (
                <div
                  key={s.name}
                  className="flex h-full items-center rounded px-2 text-xs font-semibold text-white"
                  style={{ width: `${pct}%`, background: s.color }}
                >
                  {/* a block too narrow for its label prints none; the text beside carries it */}
                  {pct >= 12 ? `${Math.round(pct)}%` : null}
                </div>
              );
            })
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {segments.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
