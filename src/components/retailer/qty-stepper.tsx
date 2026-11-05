"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Large, thumb-friendly stepper in one soft green bar: minus, the number, plus. Typing a number also works.
 * `compact` is for narrow cards (it once collapsed to 4 px on a 320 px phone): the number box cannot
 * shrink below a readable width.
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
  const btn = `flex h-12 ${compact ? "w-11" : "w-12"} shrink-0 items-center justify-center rounded-xl text-accent transition-colors hover:bg-accent/10 active:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-30`;
  return (
    <div className="flex items-center rounded-xl bg-accent-soft" role="group" aria-label={label}>
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
        className="h-12 min-w-[2.5rem] flex-1 bg-transparent text-center text-lg font-semibold tabular-nums text-ink focus:outline-none"
      />
      <button type="button" className={btn} aria-label={`${label} +`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}
