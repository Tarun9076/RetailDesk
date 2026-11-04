/** Pack size in grams or millilitres. `unit` is null for "250 wala" (number only). */
export interface PackSize {
  amount: number;
  unit: "g" | "ml" | null;
}

/** One order line as read from the message, before any product is chosen. */
export interface ParsedLine {
  original: string; // the shopkeeper's own words for this line
  item: string; // product words with numbers, units and filler removed
  qty: number | null; // null when not stated or not a whole number
  unit: "case" | "piece" | "unknown";
  size: PackSize | null;
  sizeWord: "small" | "large" | null;
  llmCodes: string[]; // SKU codes the AI suggested, already checked against the catalogue
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface MatchResult {
  skuId: string | null; // null: nothing reliable, the shopkeeper must choose
  level: ConfidenceLevel;
  reason: "learned" | "text" | "none";
  score: number; // 0..1, shown only as the confidence level
  alternatives: { skuId: string }[]; // always up to two other products to choose from
}

/** What the browser receives for each line. */
export interface CaptureLineDto {
  index: number;
  original: string;
  item: string;
  qty: number | null;
  unit: "case" | "piece" | "unknown";
  aliasKey: string;
  skuId: string | null;
  level: ConfidenceLevel;
  reason: MatchResult["reason"];
  alternatives: { skuId: string }[];
}

export type CaptureSource = "ai" | "basic";
