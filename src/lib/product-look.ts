// How a product looks on screen, worked out from its own name. Pure functions with no browser or
// database code, so the shopkeeper's catalogue, the salesman's app and the tests all agree.

export type PackKind = "carton" | "pouch" | "bottle" | "tub" | "bar";

/**
 * The kind of pack to draw. Matched on words in the name, so a new product looks right the moment
 * it is added; anything unrecognised is a plain carton.
 */
export function packKindFor(name: string): PackKind {
  const n = name.toLowerCase();
  if (/\b(soap|bar)\b/.test(n)) return "bar";
  if (/(dishwash|liquid|cleaner|floor|phenyl|shampoo|oil|bottle|juice|\bml\b|\blitre\b|\bl\b)/.test(n)) return "bottle";
  if (/(detergent|powder|surf|washing)/.test(n)) return "tub";
  if (/(noodle|tea|chai|salt|atta|flour|rice|dal|sugar|masala|spice|pouch|namkeen|chips)/.test(n)) return "pouch";
  return "carton";
}

/** Muted, print-like colours: restrained, and every one holds white text at 4.5:1 or better. */
export const PACK_COLOURS = ["#2f7a57", "#96650f", "#35629a", "#a9503a", "#7b4a7a", "#475a66"] as const;

/**
 * The same product line always gets the same colour ("Cream biscuit 200 g" and "Cream biscuit 48 g" match,
 * "Glucose biscuit" differs), so a shopkeeper learns the packs by sight, and two biscuits side by side are never twins.
 */
export function packColourFor(brand: string, name = ""): string {
  const line = name.split(/\d/)[0].replace(/[,\s]+$/, "").toLowerCase();
  let h = 0;
  for (const ch of `${brand}|${line}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PACK_COLOURS[h % PACK_COLOURS.length];
}

/** What fits on a pack: the brand's first word, in capitals, short. */
export function packLabelFor(brand: string): string {
  return brand.trim().split(/\s+/)[0].toUpperCase().slice(0, 11);
}

/** "200 g" / "1 kg" / "500 ml" from the name, or null when it has no size. */
export function packSizeFrom(name: string): string | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s?(kg|g|ml|l)\b/i);
  return m ? `${m[1]} ${m[2].toLowerCase()}` : null;
}

export interface ProductTitle {
  /** The name a shopkeeper reads: "Cream biscuit 200 g". */
  title: string;
  /** What comes after the first comma: "case of 48". Empty when there is none. */
  detail: string;
}

/** "Cream biscuit 200 g, case of 48" becomes a short title and a quiet detail, so the card is not a wall of words. */
export function splitProductName(name: string): ProductTitle {
  const i = name.indexOf(",");
  if (i < 0) return { title: name.trim(), detail: "" };
  return { title: name.slice(0, i).trim(), detail: name.slice(i + 1).trim() };
}

/** An https picture address that is safe to show, or null. */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && url.length <= 400 ? u.toString() : null;
  } catch {
    return null;
  }
}
