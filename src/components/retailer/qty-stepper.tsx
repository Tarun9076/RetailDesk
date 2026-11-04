"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Large, thumb-friendly stepper. Typing a number also works.
 * `compact` is for narrow cards: 44 px buttons with tight gaps, and a quantity
 * box that cannot shrink below a readable width (it once collapsed to 4 px on a 320 px phone).
 */
export function QtyStepper({
  value,
  max,
  onChange,
  label,
  compact = false,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  compact?: boolean;
}) {
  const btn = `flex h-12 ${compact ? "w-11" : "w-12"} shrink-0 items-center justify-center rounded-xl border border-line bg-bg text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40`;
  return (
    <div className={`flex items-center ${compact ? "gap-1" : "gap-1.5"}`} role="group" aria-label={label}>
      <button type="button" className={btn} aria-label={`${label} −`} disabled={value <= 0} onClick={() => onChange(value - 1)}>
        <Minus size={18} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        onFocus={(e) => e.target.select()}
        className="h-12 min-w-[2.75rem] flex-1 rounded-xl border border-line bg-bg text-center text-lg font-medium focus:border-accent"
      />
      <button type="button" className={btn} aria-label={`${label} +`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}
