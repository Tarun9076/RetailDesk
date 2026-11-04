import type {
  NextBenefit,
  PricedLine,
  PricedOrder,
  PricingLineInput,
  SchemeRule,
} from "./types";

const BP = 10_000;

/** Integer paise rounding, half up. */
const roundPaise = (n: number) => Math.round(n);

function assertWholeNumber(value: number, name: string, min: number) {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`${name} must be an integer >= ${min}, got ${value}`);
  }
}

type SchemeInput = SchemeRule | SchemeRule[] | null | undefined;
const asList = (s: SchemeInput): SchemeRule[] => (Array.isArray(s) ? s : s ? [s] : []);

// India has one time zone and no daylight saving, so a fixed offset is exact.
const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const istDayStart = (d: Date) => Math.floor((d.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS;

/**
 * A scheme runs from the start of its first day to the end of its last day,
 * in Indian time. "Valid until 30 Nov" means the whole of 30 Nov.
 */
export function isSchemeLive(scheme: SchemeRule | null | undefined, now: Date): scheme is SchemeRule {
  if (!scheme || scheme.active === false) return false;
  if (scheme.validFrom && now.getTime() < istDayStart(scheme.validFrom)) return false;
  if (scheme.validUntil && now.getTime() >= istDayStart(scheme.validUntil) + DAY_MS) return false;
  return true;
}

/**
 * What a scheme is worth at `qty` cases, in units of (case price x 0.0001).
 * Free cases are worth their price; a percentage is worth that share of the
 * line. Both scale with the case price, so the price drops out and two
 * schemes on one product can be compared with whole numbers only.
 */
function benefitValue(scheme: SchemeRule, qty: number): number {
  if (scheme.type === "FREE_GOODS") return freeCasesFor(scheme, qty) * BP;
  return qty >= scheme.minQty ? qty * scheme.percentBp : 0;
}

const threshold = (s: SchemeRule) => (s.type === "FREE_GOODS" ? s.buyQty : s.minQty);

/** A fixed order, so the same rows always give the same answer. */
export function compareSchemes(a: SchemeRule, b: SchemeRule): number {
  if (a.type !== b.type) return a.type === "SLAB_PERCENT" ? -1 : 1;
  return threshold(a) - threshold(b) || a.label.localeCompare(b.label);
}

/**
 * The one scheme that applies at `qty` cases: whichever is worth most to the
 * shop. Schemes never stack. On an exact tie a percentage wins (it uses no
 * stock), then the lower threshold, then the label. Returns null when no
 * live scheme gives anything yet.
 */
export function chooseScheme(schemes: SchemeInput, qty: number, now: Date = new Date()): SchemeRule | null {
  let best: SchemeRule | null = null;
  let bestValue = 0;
  for (const s of asList(schemes)) {
    if (!isSchemeLive(s, now)) continue;
    const v = benefitValue(s, qty);
    if (v > bestValue || (v === bestValue && v > 0 && best && compareSchemes(s, best) < 0)) {
      best = s;
      bestValue = v;
    }
  }
  return best;
}

/** Free cases earned for an order of `qty` cases. Whole cases only. */
export function freeCasesFor(scheme: SchemeRule | null | undefined, qty: number): number {
  if (!scheme || scheme.type !== "FREE_GOODS") return 0;
  if (scheme.buyQty <= 0) return 0;
  return Math.floor(qty / scheme.buyQty) * scheme.freeQty;
}

/** Largest paid quantity whose paid + free cases still fit in stock. */
export function maxOrderableCases(
  stockCases: number,
  schemes: SchemeInput,
  now: Date = new Date(),
): number {
  let q = Math.max(0, stockCases);
  while (q > 0 && q + freeCasesFor(chooseScheme(schemes, q, now), q) > stockCases) q--;
  return q;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The nearest real improvement. A scheme is only suggested if, at the higher
 * quantity, it would be the one applied and worth more than what the shop
 * has now, so we never advertise a lower tier that a better one overrides.
 */
function nextBenefitFor(schemes: SchemeRule[], qty: number, now: Date): NextBenefit | null {
  if (qty <= 0) return null;
  const current = chooseScheme(schemes, qty, now);
  const currentValue = current ? benefitValue(current, qty) : 0;

  let best: { need: number; value: number; benefit: NextBenefit } | null = null;
  for (const s of schemes) {
    if (!isSchemeLive(s, now)) continue;
    let need: number;
    let benefit: NextBenefit;
    if (s.type === "FREE_GOODS") {
      if (s.buyQty <= 0 || s.freeQty <= 0) continue;
      need = s.buyQty - (qty % s.buyQty);
      benefit = { kind: "FREE_GOODS", needCases: need, freeCases: s.freeQty };
    } else {
      if (qty >= s.minQty) continue;
      need = s.minQty - qty;
      benefit = { kind: "SLAB_PERCENT", needCases: need, percentBp: s.percentBp };
    }
    const q2 = qty + need;
    if (chooseScheme(schemes, q2, now) !== s) continue;
    const value = benefitValue(s, q2);
    if (value <= currentValue) continue;
    if (!best || need < best.need || (need === best.need && value > best.value)) best = { need, value, benefit };
  }
  return best?.benefit ?? null;
}

function hintText(b: NextBenefit | null): string | null {
  if (!b) return null;
  return b.kind === "FREE_GOODS"
    ? `Add ${plural(b.needCases, "more case")} to get ${plural(b.freeCases, "case")} free`
    : `Add ${plural(b.needCases, "more case")} for ${b.percentBp / 100}% off`;
}

export function priceLine(
  input: PricingLineInput,
  now: Date = new Date(),
): PricedLine {
  assertWholeNumber(input.qtyCases, "qtyCases", 0);
  assertWholeNumber(input.unitPricePaise, "unitPricePaise", 0);
  assertWholeNumber(input.piecesPerCase, "piecesPerCase", 1);
  assertWholeNumber(input.gstRateBp, "gstRateBp", 0);
  assertWholeNumber(input.stockCases, "stockCases", 0);

  const live = asList(input.scheme).filter((s) => isSchemeLive(s, now));
  const qty = input.qtyCases;
  const grossPaise = qty * input.piecesPerCase * input.unitPricePaise;

  // One scheme applies: the best for this quantity. null means none has kicked in yet.
  const scheme = chooseScheme(live, qty, now);
  const freeCases = freeCasesFor(scheme, qty);

  let discountPaise = 0;
  if (scheme?.type === "SLAB_PERCENT") {
    discountPaise = roundPaise((grossPaise * scheme.percentBp) / BP);
  }

  // Free goods carry no value, so GST is charged on paid goods only.
  const taxablePaise = grossPaise - discountPaise;
  const gstPaise = roundPaise((taxablePaise * input.gstRateBp) / BP);

  const nextBenefit = nextBenefitFor(live, qty, now);

  let issue: PricedLine["issue"] = null;
  if (input.stockCases === 0 && qty > 0) {
    issue = { code: "OUT_OF_STOCK" };
  } else if (qty + freeCases > input.stockCases) {
    issue = {
      code: "INSUFFICIENT_STOCK",
      availableCases: input.stockCases,
      maxOrderableCases: maxOrderableCases(input.stockCases, live, now),
    };
  }

  return {
    skuId: input.skuId,
    qtyCases: qty,
    freeCases,
    grossPaise,
    discountPaise,
    taxablePaise,
    gstPaise,
    totalPaise: taxablePaise + gstPaise,
    schemeLabel: scheme ? scheme.label : null,
    appliedScheme: scheme,
    hint: hintText(nextBenefit),
    nextBenefit,
    issue,
  };
}

export function priceOrder(
  inputs: PricingLineInput[],
  now: Date = new Date(),
): PricedOrder {
  const lines = inputs.map((i) => priceLine(i, now));
  return {
    lines,
    subtotalPaise: lines.reduce((s, l) => s + l.grossPaise, 0),
    discountPaise: lines.reduce((s, l) => s + l.discountPaise, 0),
    gstPaise: lines.reduce((s, l) => s + l.gstPaise, 0),
    totalPaise: lines.reduce((s, l) => s + l.totalPaise, 0),
    hasIssues: lines.some((l) => l.issue !== null),
  };
}
