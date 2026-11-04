import {
  CASE_WORDS,
  LARGE_WORDS,
  NUMBER_WORDS,
  PIECE_WORDS,
  SIZE_UNITS,
  SMALL_WORDS,
  STOPWORDS,
  WALA_WORDS,
} from "./vocab";
import type { ParsedLine, PackSize } from "./types";

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Lower-cases, turns Devanagari digits into 0-9 and strips punctuation. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .toLowerCase()
    .replace(/(\d)\s*[.,]\s*(?=\d)/g, "$1.") // 1,5 or 1 . 5 -> 1.5
    .replace(/(\d)([a-zऀ-ॿ])/g, "$1 $2") // 250g -> 250 g, 5peti -> 5 peti
    .replace(/[^\p{L}\p{N}\p{M}.\s]/gu, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const isNumber = (t: string | undefined): t is string => !!t && /^\d+(\.\d+)?$/.test(t);

/** Splits a pasted message into one chunk per product, keeping the shopkeeper's own words. */
export function splitSegments(text: string): string[] {
  return text
    .split(/[\n\r]+/)
    .flatMap((line) =>
      line
        // a list bullet ("1." "2)" "-") is not part of the order
        .replace(/^\s*(?:\d{1,2}[.)]\s+|[-•*]\s+)/, "")
        // semicolons, commas, a full stop or danda ending a sentence, "aur", "+"
        .split(/[;|।]+|,(?!\d)|\.(?=\s)|\s+(?:aur|and|और|plus)\s+|\s\+\s/i),
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Reads one chunk like "bhaiya 5 peti biscuit chhota" into quantity, unit,
 * pack size and the product words. It never guesses a missing quantity or
 * unit: they come back as null / "unknown" so the shopkeeper is asked.
 */
export function extractLine(segment: string): ParsedLine | null {
  const tokens = normalizeText(segment).split(" ").filter(Boolean);

  // "do peti" -> "2 peti"
  for (let i = 0; i < tokens.length - 1; i++) {
    const n = NUMBER_WORDS[tokens[i]];
    const next = tokens[i + 1];
    if (n !== undefined && (CASE_WORDS.has(next) || PIECE_WORDS.has(next))) tokens[i] = String(n);
  }

  const used = new Array<boolean>(tokens.length).fill(false);
  let qty: number | null = null;
  let unit: ParsedLine["unit"] = "unknown";
  let size: PackSize | null = null;

  // 1. quantity with a pack word: "5 peti", "peti 5", "10 pcs"
  for (let i = 0; i < tokens.length && qty === null; i++) {
    const t = tokens[i];
    const kind = CASE_WORDS.has(t) ? "case" : PIECE_WORDS.has(t) ? "piece" : null;
    if (!kind) continue;
    if (isNumber(tokens[i - 1]) && !used[i - 1]) {
      qty = Number(tokens[i - 1]);
      used[i - 1] = used[i] = true;
      unit = kind;
    } else if (isNumber(tokens[i + 1])) {
      qty = Number(tokens[i + 1]);
      used[i] = used[i + 1] = true;
      unit = kind;
    }
  }

  // 2. pack size: "1 kilo", "250 g", "250 wala"
  for (let i = 0; i < tokens.length - 1 && size === null; i++) {
    if (used[i] || !isNumber(tokens[i])) continue;
    const next = tokens[i + 1];
    const su = SIZE_UNITS[next];
    if (su) {
      size = { amount: Number(tokens[i]) * su.factor, unit: su.unit };
      used[i] = used[i + 1] = true;
    } else if (WALA_WORDS.has(next)) {
      size = { amount: Number(tokens[i]), unit: null };
      used[i] = used[i + 1] = true;
    }
  }

  // 3. a bare number that is left over is a quantity with no unit stated
  if (qty === null) {
    const i = tokens.findIndex((t, idx) => !used[idx] && isNumber(t));
    if (i >= 0) {
      qty = Number(tokens[i]);
      used[i] = true;
    }
  }

  let sizeWord: ParsedLine["sizeWord"] = null;
  const content: string[] = [];
  tokens.forEach((t, i) => {
    if (used[i]) return;
    if (SMALL_WORDS.has(t)) sizeWord = "small";
    else if (LARGE_WORDS.has(t)) sizeWord = "large";
    else if (!STOPWORDS.has(t) && !isNumber(t) && !SIZE_UNITS[t]) content.push(t);
  });

  if (content.length === 0) return null; // "thanks", "ok", a greeting
  if (qty !== null && (!Number.isFinite(qty) || qty <= 0 || qty > 1000)) qty = null;
  if (qty !== null && !Number.isInteger(qty)) qty = null; // "1.5 peti": ask, do not round

  return { original: segment.trim(), item: content.join(" "), qty, unit, size, sizeWord, llmCodes: [] };
}

/** Basic reader used when the AI is unavailable. */
export function parseBasic(text: string): ParsedLine[] {
  return splitSegments(text)
    .map(extractLine)
    .filter((l): l is ParsedLine => l !== null)
    .slice(0, 40);
}
