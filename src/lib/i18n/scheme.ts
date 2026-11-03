import type { NextBenefit, SchemeRule } from "@/lib/pricing/types";
import type { Lang } from "./dict";

/** Scheme text built from the rule itself, so it is correct in either language. */
export function schemeText(rule: SchemeRule, lang: Lang): string {
  if (rule.type === "FREE_GOODS") {
    return lang === "hi"
      ? `${rule.buyQty} पेटी लें, ${rule.freeQty} मुफ़्त पाएँ`
      : `Buy ${rule.buyQty} cases, get ${rule.freeQty} free`;
  }
  const p = rule.percentBp / 100;
  return lang === "hi"
    ? `${rule.minQty} या ज़्यादा पेटी पर ${p}% छूट`
    : `${p}% off on ${rule.minQty}+ cases`;
}

/** `again` is true when a free case is already earned, so the next one is "another". */
export function nextBenefitText(b: NextBenefit, lang: Lang, again = false): string {
  if (b.kind === "FREE_GOODS") {
    return lang === "hi"
      ? `${b.needCases} पेटी और लें, ${b.freeCases} पेटी${again ? " और" : ""} मुफ़्त पाएँ`
      : `Add ${b.needCases} more ${b.needCases === 1 ? "case" : "cases"} to get ${b.freeCases}${again ? " more" : ""} free`;
  }
  const p = b.percentBp / 100;
  return lang === "hi"
    ? `${b.needCases} पेटी और लें, ${p}% छूट पाएँ`
    : `Add ${b.needCases} more ${b.needCases === 1 ? "case" : "cases"} for ${p}% off`;
}
