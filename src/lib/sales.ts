// Pure helpers for the sales dashboard: date ranges, chart scales and number formats.

const DAY_MS = 86_400_000;
/** India is UTC+5:30 all year, with no daylight saving. */
const IST_OFFSET_MS = 19_800_000;

export type RangeKey = "today" | "7" | "30" | "90";

export const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
];

export function parseRange(value: string | undefined): RangeKey {
  return RANGES.find((r) => r.key === value)?.key ?? "30";
}

/** The moment an Indian calendar day begins (midnight in India) for the day containing `d`. */
export function istDayStart(d: Date): Date {
  return new Date(Math.floor((d.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

/** "2026-11-04" for the Indian calendar day containing `d`. */
export function dayKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export interface Period {
  key: RangeKey;
  days: number;
  from: Date; // inclusive
  to: Date; // exclusive: the start of tomorrow in India
  prevFrom: Date;
  prevTo: Date; // equals `from`
}

/**
 * A range of whole Indian calendar days ending today, plus the same number of
 * days just before it for comparison. "Last 7 days" is today and the 6 days before.
 */
export function periodFor(key: RangeKey, now: Date): Period {
  const days = RANGES.find((r) => r.key === key)!.days;
  const today = istDayStart(now);
  const to = new Date(today.getTime() + DAY_MS);
  const from = new Date(to.getTime() - days * DAY_MS);
  return { key, days, from, to, prevFrom: new Date(from.getTime() - days * DAY_MS), prevTo: from };
}

export interface DayPoint {
  day: string; // YYYY-MM-DD
  orders: number;
  netPaise: number;
}

/** One point for every day in the period, with zeros where nothing was sold, so a quiet day shows as a gap in the bars. */
export function fillDays(rows: DayPoint[], from: Date, days: number): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(new Date(from.getTime() + i * DAY_MS));
    return byDay.get(day) ?? { day, orders: 0, netPaise: 0 };
  });
}

/** Change against the period before, as a fraction (0.12 = +12%). Null when there was nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

export function shareOf(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/**
 * Money in the way an Indian business says it: 1.2 Cr, 2.4 L, 45K. Used where
 * space is tight (axis labels, tiles); full amounts are shown in tooltips and tables.
 */
export function formatCompactPaise(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? "-" : "";
  const trim = (n: number) => n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
  if (rupees >= 1e7) return `${sign}₹${trim(rupees / 1e7)} Cr`;
  if (rupees >= 1e5) return `${sign}₹${trim(rupees / 1e5)} L`;
  if (rupees >= 1e3) return `${sign}₹${trim(rupees / 1e3)}K`;
  return `${sign}₹${Math.round(rupees)}`;
}

/** Axis ticks on round numbers: [0, 25L, 50L, 75L, 100L], not [0, 23.7L, ...]. All in paise. */
export function niceScale(maxPaise: number, tickCount = 4): { max: number; ticks: number[] } {
  if (!(maxPaise > 0)) return { max: 100_000, ticks: [0, 100_000] }; // an empty chart still gets an axis
  const rawStep = maxPaise / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) as number) ?? magnitude * 10;
  const max = Math.ceil(maxPaise / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return { max, ticks };
}

/** "4 Nov" for a YYYY-MM-DD day, without any time zone surprises. */
export function shortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
}
