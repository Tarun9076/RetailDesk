import { CANONICAL_WORDS, LARGE_WORDS, SMALL_WORDS, STOPWORDS, SYNONYMS } from "./vocab";
import type { MatchResult, PackSize, ParsedLine } from "./types";

/** The few product fields matching needs. */
export interface MatchItem {
  id: string;
  code: string;
  name: string;
  stockCases: number;
}

export interface MatchContext {
  items: MatchItem[];
  aliases: Map<string, string>; // alias key -> sku id, learned for this retailer
  history: Map<string, number>; // sku id -> how often this retailer ordered it
}

// Evidence weights. Kept in one place so they can be tuned against real messages.
const W = {
  textCoverage: 0.7,
  textSpecificity: 0.3,
  sizeMatch: 0.35,
  sizeMismatch: -0.35,
  sizeWord: 0.2,
  history: 0.15,
  llmAgrees: 0.15,
  learned: 1.2,
};
const HIGH_SCORE = 0.8;
const HIGH_MARGIN = 0.2;
const MEDIUM_SCORE = 0.5;
const NO_MATCH_BELOW = 0.35;

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** Maps a spoken word to the word used in product names, forgiving small typos. */
export function canonicalToken(token: string): string {
  if (SYNONYMS[token]) return SYNONYMS[token];
  if (!/^[a-z]+$/.test(token) || token.length < 5) return token;
  const allowed = token.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestD = allowed + 1;
  let tie = false;
  for (const word of CANONICAL_WORDS) {
    const d = distance(token, word);
    if (d < bestD) {
      best = word;
      bestD = d;
      tie = false;
    } else if (d === bestD) tie = true;
  }
  return best && !tie && bestD <= allowed ? best : token;
}

const uniq = (xs: string[]) => [...new Set(xs)];

const isSizeWord = (t: string) => SMALL_WORDS.has(t) || LARGE_WORDS.has(t);

/** Product words only: size adjectives like "chhota" are read separately. */
export function itemTokens(item: string): string[] {
  return uniq(item.split(" ").filter((t) => t && !isSizeWord(t)).map(canonicalToken));
}

/** The size adjective, from the field if present, otherwise from inside the item text. */
export function effectiveSizeWord(line: Pick<ParsedLine, "item" | "sizeWord">): "small" | "large" | null {
  if (line.sizeWord) return line.sizeWord;
  for (const t of line.item.split(" ")) {
    if (SMALL_WORDS.has(t)) return "small";
    if (LARGE_WORDS.has(t)) return "large";
  }
  return null;
}

/**
 * The key under which a phrase is remembered for a shop. Word order, spelling
 * variants and Hindi/English synonyms all collapse to the same key, so
 * "chhota biscuit" and "biscuit chota" are one habit.
 */
export function aliasKey(line: Pick<ParsedLine, "item" | "size" | "sizeWord">): string {
  const parts = itemTokens(line.item).sort();
  const sizeWord = effectiveSizeWord(line);
  if (sizeWord) parts.push(`~${sizeWord}`);
  if (line.size) parts.push(`@${line.size.amount}${line.size.unit ?? ""}`);
  return parts.join(" ");
}

/**
 * Should a shopkeeper's choice become a remembered habit for their shop?
 * Yes when they corrected a guess, or picked on a line the matcher was unsure
 * about. No when the guess was already right and sure, and no when they only
 * swapped away from a product that was out of stock (a substitution).
 */
export function shouldLearnAlias(input: {
  aliasKey: string;
  suggestedSkuId: string | null;
  suggestedLevel: "high" | "medium" | "low";
  chosenSkuId: string;
  suggestedOutOfStock: boolean;
}): boolean {
  if (!input.aliasKey || input.aliasKey.length > 80) return false;
  const corrected = input.suggestedSkuId !== input.chosenSkuId;
  if (corrected && input.suggestedSkuId && input.suggestedOutOfStock) return false;
  return corrected || input.suggestedLevel !== "high";
}

interface Doc {
  item: MatchItem;
  tokens: Set<string>;
  size: { amount: number; unit: "g" | "ml" } | null;
}

function toDoc(item: MatchItem): Doc {
  const name = item.name.toLowerCase().replace(/,\s*case of \d+/, "");
  const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  let size: Doc["size"] = null;
  if (sizeMatch) {
    const n = Number(sizeMatch[1]);
    const u = sizeMatch[2];
    size = u === "kg" ? { amount: n * 1000, unit: "g" } : u === "l" ? { amount: n * 1000, unit: "ml" } : { amount: n, unit: u as "g" | "ml" };
  }
  const words = (name.match(/[a-z]+/g) ?? []).filter((w) => !STOPWORDS.has(w) && !["g", "kg", "ml", "l"].includes(w));
  return { item, tokens: new Set(words.map(canonicalToken)), size };
}

function sizeEvidence(user: PackSize | null, sku: Doc["size"]): number {
  if (!user || !sku) return 0;
  if (user.unit === null) {
    // "250 wala": compare the bare number with the SKU's size, or its size in kg/l.
    return user.amount === sku.amount || user.amount * 1000 === sku.amount ? W.sizeMatch : W.sizeMismatch;
  }
  if (user.unit !== sku.unit) return 0; // grams vs millilitres: not comparable
  return user.amount === sku.amount ? W.sizeMatch : W.sizeMismatch;
}

interface Scored {
  doc: Doc;
  raw: number;
  textHit: boolean;
}

export function matchLine(line: ParsedLine, ctx: MatchContext): MatchResult {
  const docs = ctx.items.map(toDoc);
  const user = itemTokens(line.item);
  const sizeWord = effectiveSizeWord(line);
  const key = aliasKey(line);

  // A habit this shop already taught us wins outright.
  const learnedId = ctx.aliases.get(key);
  const learnedDoc = learnedId ? docs.find((d) => d.item.id === learnedId) : undefined;

  const matchedCounts = docs.map((d) => user.filter((t) => d.tokens.has(t)).length);
  const withText = docs.filter((_, i) => matchedCounts[i] > 0);

  // Size-word ranking among the products that fit the words.
  const sized = withText.filter((d) => d.size).sort((a, b) => a.size!.amount - b.size!.amount);
  const histTotal = withText.reduce((s, d) => s + (ctx.history.get(d.item.id) ?? 0), 0);

  const scored: Scored[] = docs.map((d, i) => {
    const matched = matchedCounts[i];
    let raw = 0;
    if (matched > 0) {
      const coverage = user.length ? matched / user.length : 0;
      const specificity = d.tokens.size ? matched / d.tokens.size : 0;
      raw = W.textCoverage * coverage + W.textSpecificity * specificity;
      raw += sizeEvidence(line.size, d.size);
      if (sizeWord && d.size && sized.length > 1) {
        const rank = sized.indexOf(d);
        const frac = 1 - rank / (sized.length - 1); // 1 for smallest, 0 for largest
        raw += W.sizeWord * (sizeWord === "small" ? frac : 1 - frac);
      }
      if (histTotal > 0) raw += W.history * ((ctx.history.get(d.item.id) ?? 0) / histTotal);
    }
    if (line.llmCodes.includes(d.item.code)) raw += W.llmAgrees;
    if (learnedDoc && d === learnedDoc) raw = W.learned;
    return { doc: d, raw, textHit: matched > 0 };
  });

  scored.sort(
    (a, b) =>
      b.raw - a.raw ||
      Number(b.doc.item.stockCases > 0) - Number(a.doc.item.stockCases > 0) ||
      a.doc.item.name.localeCompare(b.doc.item.name),
  );

  const best = scored[0];
  const second = scored[1];
  const isLearned = !!learnedDoc && best.doc === learnedDoc;
  const matched = best && best.raw >= NO_MATCH_BELOW;

  let level: MatchResult["level"] = "low";
  if (isLearned) level = "high";
  else if (matched && best.raw >= HIGH_SCORE && best.raw - (second?.raw ?? 0) >= HIGH_MARGIN) level = "high";
  else if (matched && best.raw >= MEDIUM_SCORE) level = "medium";

  const chosen = matched ? best : null;
  const rest = scored.filter((s) => s !== chosen);

  // Two alternatives, always: things that fit the words first, then what this
  // shop usually buys, then anything in stock.
  const fits = rest.filter((s) => s.textHit || line.llmCodes.includes(s.doc.item.code));
  const usual = rest
    .filter((s) => !fits.includes(s) && (ctx.history.get(s.doc.item.id) ?? 0) > 0)
    .sort((a, b) => (ctx.history.get(b.doc.item.id) ?? 0) - (ctx.history.get(a.doc.item.id) ?? 0));
  const others = rest.filter((s) => !fits.includes(s) && !usual.includes(s));
  const alternatives = [...fits, ...usual, ...others].slice(0, 2).map((s) => ({ skuId: s.doc.item.id }));

  return {
    skuId: chosen ? chosen.doc.item.id : null,
    level,
    reason: isLearned ? "learned" : chosen ? "text" : "none",
    score: chosen ? Math.min(1, Math.max(0, best.raw)) : 0,
    alternatives,
  };
}
