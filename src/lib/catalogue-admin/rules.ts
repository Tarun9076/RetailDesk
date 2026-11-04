// Client-safe rules for the desk's catalogue screens. No database, no server-only code,
// so the forms and the API check things the same way and the rules can be unit tested.
import { formatPaise } from "@/lib/money";
import { isSchemeLive } from "@/lib/pricing/engine";
import type { SchemeRule } from "@/lib/pricing/types";

/** GST slabs used for goods like these. The desk picks one; it is stored in basis points (12% = 1200). */
export const GST_RATES_BP = [0, 500, 1200, 1800, 2800] as const;

/**
 * "7.9" -> 790, "1,250.50" -> 125050, "₹ 8" -> 800. Returns null for anything
 * that is not a positive amount with at most two decimals, so a typo is never
 * silently turned into a price.
 */
export function parseRupees(input: string): number | null {
  const trimmed = input.replace(/[₹\s]/g, "");
  // Commas are only accepted where they really are thousands separators (1,250.50 or 1,25,000), so "7,9,0" is not read as 790.
  if (trimmed.includes(",") && !/^\d{1,3}(,\d{3}|,\d{2})*,\d{3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const cleaned = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

/** 790 -> "7.90", for putting a stored price back into a form field. */
export function paiseToInput(paise: number): string {
  return (paise / 100).toFixed(2);
}

/** "3" -> 300, "2.5" -> 250. A percentage with at most two decimals, between 0.01 and 100. */
export function parsePercentBp(input: string): number | null {
  const cleaned = input.replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const bp = Math.round(Number(cleaned) * 100);
  return bp >= 1 && bp <= 10000 ? bp : null;
}

export interface SchemeFields {
  type: "FREE_GOODS" | "SLAB_PERCENT";
  buyQty?: number | null;
  freeQty?: number | null;
  minQty?: number | null;
  percentBp?: number | null;
}

const pct = (bp: number) => `${Number((bp / 100).toFixed(2))}%`;

/** The sentence shopkeepers see in English, built from the rule so it can never disagree with it. */
export function schemeLabelFor(s: SchemeFields): string {
  if (s.type === "FREE_GOODS") return `Buy ${s.buyQty} cases get ${s.freeQty} free`;
  return `${pct(s.percentBp ?? 0)} off ${s.minQty} or more cases`;
}

/**
 * A date picked on the desk ("2026-11-30") as an instant: midnight at the start
 * of that day in India. The engine treats a scheme as running through the whole
 * of its last Indian day, so only the day matters.
 */
export function istDay(date: string): Date {
  return new Date(`${date}T00:00:00+05:30`);
}

/** A stored instant back to the "YYYY-MM-DD" a date field needs, in Indian time. */
export function toIstDateInput(d: Date | null): string {
  if (!d) return "";
  const ist = new Date(d.getTime() + 330 * 60_000);
  return ist.toISOString().slice(0, 10);
}

export interface ProductFields {
  name: string;
  nameHi: string | null;
  brand: string;
  piecesPerCase: number;
  pricePaise: number;
  gstRateBp: number;
  active: boolean;
}

/** Plain-words list of what changed between two versions of a product, for the history. Empty when nothing did. */
export function describeProductChange(before: ProductFields, after: ProductFields): string[] {
  const out: string[] = [];
  if (before.name !== after.name) out.push(`Name "${before.name}" to "${after.name}"`);
  if ((before.nameHi ?? "") !== (after.nameHi ?? "")) out.push("Hindi name changed");
  if (before.brand !== after.brand) out.push(`Brand "${before.brand}" to "${after.brand}"`);
  if (before.piecesPerCase !== after.piecesPerCase) out.push(`Pieces per case ${before.piecesPerCase} to ${after.piecesPerCase}`);
  if (before.pricePaise !== after.pricePaise) out.push(`Dealer price ${formatPaise(before.pricePaise)} to ${formatPaise(after.pricePaise)} per piece`);
  if (before.gstRateBp !== after.gstRateBp) out.push(`GST ${before.gstRateBp / 100}% to ${after.gstRateBp / 100}%`);
  if (before.active !== after.active) out.push(after.active ? "Put back on sale" : "Taken off sale");
  return out;
}

/** What a stock change reads like in the history. */
export function describeStockChange(before: number, after: number, reason: string): string {
  const d = after - before;
  const sign = d > 0 ? "+" : "−";
  return `Stock ${before} to ${after} cases (${sign}${Math.abs(d)}): ${reason}`;
}

export type SchemeStatus = "live" | "off" | "scheduled" | "expired";

/** Where a stored scheme stands today, in words the desk reads at a glance. */
export function schemeStatus(
  s: { active: boolean; validFrom: Date | null; validUntil: Date | null; type: SchemeFields["type"] } & SchemeFields,
  now: Date = new Date(),
): SchemeStatus {
  if (!s.active) return "off";
  const rule = (until: Date | null) => ({ ...(s as SchemeRule), validFrom: s.validFrom, validUntil: until });
  if (isSchemeLive(rule(s.validUntil), now)) return "live";
  // Not live although switched on: either it has not started, or it has ended.
  return s.validUntil && isSchemeLive(rule(null), now) ? "expired" : "scheduled";
}

/** Warns about a scheme that can never apply, so it is not saved by mistake. Returns a message or null. */
export function schemeProblem(s: SchemeFields & { validFrom?: string | null; validUntil?: string | null }): string | null {
  if (s.type === "FREE_GOODS") {
    if (!s.buyQty || !s.freeQty) return "Enter how many cases to buy and how many come free.";
  } else if (!s.minQty || !s.percentBp) {
    return "Enter the number of cases and the percentage.";
  }
  if (s.validFrom && s.validUntil && s.validUntil < s.validFrom) return "The end date is before the start date.";
  return null;
}
