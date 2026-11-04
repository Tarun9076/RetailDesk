// Word lists for reading Hindi, Hinglish and English order messages.
// Plain data on purpose: easy to extend when the client's shops show new habits.

/** Words that mean "cases" in a distributor's shorthand. */
export const CASE_WORDS = new Set([
  "peti", "petti", "pethi", "पेटी", "case", "cases", "carton", "cartons", "ctn", "ctns",
]);

/** Words that mean loose pieces or packets. */
export const PIECE_WORDS = new Set([
  "piece", "pieces", "pc", "pcs", "pkt", "pkts", "packet", "packets", "nag", "नग", "पीस", "पैकेट",
]);

/** Hindi number words. Only used right before a unit word ("do peti"), so "do" the verb is safe. */
export const NUMBER_WORDS: Record<string, number> = {
  ek: 1, एक: 1, do: 2, दो: 2, teen: 3, तीन: 3, char: 4, chaar: 4, चार: 4,
  paanch: 5, panch: 5, pach: 5, पाँच: 5, पांच: 5, chhe: 6, chheh: 6, che: 6, छह: 6, छः: 6,
  saat: 7, सात: 7, aath: 8, आठ: 8, nau: 9, नौ: 9, das: 10, दस: 10,
  gyarah: 11, barah: 12, bara: 12, pandrah: 15, bees: 20,
};

/** Unit words that describe the pack size, with the factor to grams or millilitres. */
export const SIZE_UNITS: Record<string, { factor: number; unit: "g" | "ml" }> = {
  g: { factor: 1, unit: "g" }, gm: { factor: 1, unit: "g" }, gms: { factor: 1, unit: "g" },
  gram: { factor: 1, unit: "g" }, grams: { factor: 1, unit: "g" }, ग्राम: { factor: 1, unit: "g" },
  kg: { factor: 1000, unit: "g" }, kgs: { factor: 1000, unit: "g" }, kilo: { factor: 1000, unit: "g" },
  kilogram: { factor: 1000, unit: "g" }, किलो: { factor: 1000, unit: "g" },
  ml: { factor: 1, unit: "ml" }, मिली: { factor: 1, unit: "ml" },
  l: { factor: 1000, unit: "ml" }, ltr: { factor: 1000, unit: "ml" }, litre: { factor: 1000, unit: "ml" },
  liter: { factor: 1000, unit: "ml" }, लीटर: { factor: 1000, unit: "ml" },
};

/** "250 wala" style: a number that names the pack size without a unit. */
export const WALA_WORDS = new Set(["wala", "wali", "wale", "वाला", "वाली", "वाले"]);

export const SMALL_WORDS = new Set(["chhota", "chota", "chhoti", "choti", "छोटा", "छोटी", "small", "mini"]);
export const LARGE_WORDS = new Set(["bada", "badaa", "badi", "bade", "बड़ा", "बड़ी", "large", "big", "family"]);

/** Politeness, verbs and glue words that carry no product meaning. */
export const STOPWORDS = new Set([
  "bhaiya", "bhaiyya", "bhai", "bhaisahab", "sir", "ji", "hello", "hi", "namaste", "namaskar",
  "please", "plz", "pls", "kindly", "bhejo", "bhej", "dena", "de", "dijiye", "diji", "chahiye",
  "chaiye", "चाहिए", "भेज", "भैया", "ka", "ki", "ke", "ko", "ek", "of", "the", "a", "an", "for",
  "mujhe", "mere", "hame", "hamein", "order", "kar", "karo", "bhi", "aur", "and", "do", "thanks",
  "thank", "you", "ok", "okay", "case", "cases", "total", "nos", "no", "x", "का", "की", "के", "को",
  "और", "ही", "है", "hai", "wala", "wali", "wale",
]);

/**
 * What a shopkeeper says -> the word we use in product names. Everything
 * ambiguous is left alone: the matcher then reports low confidence instead of guessing.
 */
export const SYNONYMS: Record<string, string> = {
  // biscuits
  biscuit: "biscuit", biscuits: "biscuit", biscut: "biscuit", biskut: "biscuit", bisket: "biscuit",
  बिस्कुट: "biscuit", बिस्किट: "biscuit",
  glucose: "glucose", gluco: "glucose", ग्लूकोज: "glucose", ग्लूकोज़: "glucose",
  cream: "cream", क्रीम: "cream",
  // detergent
  detergent: "detergent", washing: "detergent", surf: "detergent", डिटर्जेंट: "detergent",
  kapde: "detergent", कपड़े: "detergent",
  powder: "powder", पाउडर: "powder",
  // tea
  tea: "tea", chai: "tea", chay: "tea", chaipatti: "tea", चाय: "tea",
  leaf: "leaf", patti: "leaf", pati: "leaf", पत्ती: "leaf",
  // others
  noodles: "noodles", noodle: "noodles", nudles: "noodles", नूडल्स: "noodles", instant: "instant",
  salt: "salt", namak: "salt", नमक: "salt", iodised: "iodised", iodized: "iodised",
  soap: "soap", sabun: "soap", साबुन: "soap", bath: "bath", nahane: "bath",
  dishwash: "dishwash", bartan: "dishwash", बर्तन: "dishwash", dish: "dishwash", liquid: "liquid",
  floor: "floor", farsh: "floor", pharsh: "floor", फर्श: "floor",
  cleaner: "cleaner", cleaning: "cleaner", pocha: "cleaner", पोछा: "cleaner",
};

/** The words product names are built from; used to forgive one-letter typos. */
export const CANONICAL_WORDS = [
  "biscuit", "glucose", "cream", "detergent", "powder", "tea", "leaf", "noodles", "instant",
  "salt", "iodised", "soap", "bath", "dishwash", "liquid", "floor", "cleaner",
];
