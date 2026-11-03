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

export function isSchemeLive(scheme: SchemeRule | null | undefined, now: Date): scheme is SchemeRule {
  if (!scheme || scheme.active === false) return false;
  if (scheme.validFrom && now < scheme.validFrom) return false;
  if (scheme.validUntil && now > scheme.validUntil) return false;
  return true;
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
  scheme: SchemeRule | null | undefined,
): number {
  let q = Math.max(0, stockCases);
  while (q > 0 && q + freeCasesFor(scheme, q) > stockCases) q--;
  return q;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function nextBenefitFor(scheme: SchemeRule | null, qty: number): NextBenefit | null {
  if (!scheme || qty <= 0) return null;
  if (scheme.type === "FREE_GOODS") {
    return {
      kind: "FREE_GOODS",
      needCases: scheme.buyQty - (qty % scheme.buyQty),
      freeCases: scheme.freeQty,
    };
  }
  if (qty < scheme.minQty) {
    return { kind: "SLAB_PERCENT", needCases: scheme.minQty - qty, percentBp: scheme.percentBp };
  }
  return null;
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

  const scheme = isSchemeLive(input.scheme, now) ? input.scheme : null;
  const qty = input.qtyCases;
  const grossPaise = qty * input.piecesPerCase * input.unitPricePaise;

  const freeCases = freeCasesFor(scheme, qty);

  let discountPaise = 0;
  let applied = freeCases > 0;
  if (scheme?.type === "SLAB_PERCENT" && qty >= scheme.minQty) {
    discountPaise = roundPaise((grossPaise * scheme.percentBp) / BP);
    applied = true;
  }

  // Free goods carry no value, so GST is charged on paid goods only.
  const taxablePaise = grossPaise - discountPaise;
  const gstPaise = roundPaise((taxablePaise * input.gstRateBp) / BP);

  const nextBenefit = nextBenefitFor(scheme, qty);

  let issue: PricedLine["issue"] = null;
  if (input.stockCases === 0 && qty > 0) {
    issue = { code: "OUT_OF_STOCK" };
  } else if (qty + freeCases > input.stockCases) {
    issue = {
      code: "INSUFFICIENT_STOCK",
      availableCases: input.stockCases,
      maxOrderableCases: maxOrderableCases(input.stockCases, scheme),
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
    schemeLabel: applied && scheme ? scheme.label : null,
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
