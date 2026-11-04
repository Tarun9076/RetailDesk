import { describe, expect, it } from "vitest";
import {
  aliasKey,
  canonicalToken,
  matchLine,
  shouldLearnAlias,
  type MatchContext,
  type MatchItem,
} from "./match";
import { parseBasic } from "./text";
import type { ParsedLine } from "./types";

// The brief's three SKUs plus the invented ones, ids = codes for readable tests.
const item = (code: string, name: string, stockCases: number): MatchItem => ({ id: code, code, name, stockCases });
const ITEMS: MatchItem[] = [
  item("SKU-BS-075", "Glucose biscuit 75 g, case of 96", 340),
  item("SKU-DT-1KG", "Detergent powder 1 kg, case of 20", 85),
  item("SKU-TE-250", "Tea leaf 250 g, case of 40", 0),
  item("SKU-BS-200", "Cream biscuit 200 g, case of 48", 120),
  item("SKU-GB-150", "Glucose biscuit 150 g, case of 48", 8),
  item("SKU-NM-070", "Instant noodles 70 g, case of 48", 210),
  item("SKU-SA-1KG", "Iodised salt 1 kg, case of 25", 400),
  item("SKU-TE-100", "Tea leaf 100 g, case of 80", 95),
  item("SKU-DT-500", "Detergent powder 500 g, case of 40", 140),
  item("SKU-DW-500", "Dishwash liquid 500 ml, case of 24", 60),
  item("SKU-FC-1L", "Floor cleaner 1 l, case of 12", 18),
  item("SKU-SP-100", "Bath soap 100 g, case of 72", 300),
];

const ctx = (over: Partial<MatchContext> = {}): MatchContext => ({
  items: ITEMS,
  aliases: new Map(),
  history: new Map(),
  ...over,
});

const line = (text: string, over: Partial<ParsedLine> = {}): ParsedLine => ({
  ...parseBasic(text)[0],
  ...over,
});

const SAMPLE = parseBasic(
  "bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti",
);

describe("canonicalToken", () => {
  it("maps Hinglish and Hindi words to product words", () => {
    expect(canonicalToken("chai")).toBe("tea");
    expect(canonicalToken("patti")).toBe("leaf");
    expect(canonicalToken("washing")).toBe("detergent");
    expect(canonicalToken("namak")).toBe("salt");
    expect(canonicalToken("बिस्कुट")).toBe("biscuit");
  });

  it("forgives a small typo in a long word but not in a short one", () => {
    expect(canonicalToken("biscuet")).toBe("biscuit");
    expect(canonicalToken("detergant")).toBe("detergent");
    expect(canonicalToken("tee")).toBe("tee"); // too short to guess
  });

  it("leaves unknown words alone", () => {
    expect(canonicalToken("pepsi")).toBe("pepsi");
  });
});

describe("aliasKey", () => {
  it("is the same whatever the word order or spelling", () => {
    // a size word inside the text (as an AI might return it) is read like the field
    expect(aliasKey({ item: "chhota biscuit", size: null, sizeWord: null })).toBe(
      aliasKey({ item: "biscuit", size: null, sizeWord: "small" }),
    );
    // but "small biscuit" and plain "biscuit" are different habits
    expect(aliasKey({ item: "small biscuit", size: null, sizeWord: null })).not.toBe(
      aliasKey({ item: "biscuit", size: null, sizeWord: null }),
    );
    const a = parseBasic("5 peti biscuit chhota")[0];
    const b = parseBasic("chota biskut 3 peti")[0];
    expect(aliasKey(a)).toBe(aliasKey(b));
  });

  it("keeps different pack sizes apart", () => {
    const a = parseBasic("1 peti surf 1 kilo")[0];
    const b = parseBasic("1 peti surf 500 g")[0];
    expect(aliasKey(a)).not.toBe(aliasKey(b));
  });
});

describe("the sample message", () => {
  it("picks the 1 kg detergent with high confidence", () => {
    const r = matchLine(SAMPLE[1], ctx());
    expect(r.skuId).toBe("SKU-DT-1KG");
    expect(r.level).toBe("high");
    expect(r.alternatives.map((a) => a.skuId)).toContain("SKU-DT-500");
  });

  it("picks the 250 g tea with high confidence, even though it is out of stock", () => {
    const r = matchLine(SAMPLE[2], ctx());
    expect(r.skuId).toBe("SKU-TE-250");
    expect(r.level).toBe("high");
  });

  it("is not sure about 'biscuit chhota' for a shop it knows nothing about", () => {
    const r = matchLine(SAMPLE[0], ctx());
    expect(r.skuId).toBe("SKU-BS-075"); // the smallest biscuit
    expect(r.level).toBe("medium"); // but three biscuits fit, so it asks
    expect(r.alternatives.map((a) => a.skuId).sort()).toEqual(["SKU-BS-200", "SKU-GB-150"]);
  });

  it("is sure once the shop has taught it 'chhota biscuit'", () => {
    const key = aliasKey(SAMPLE[0]);
    const r = matchLine(SAMPLE[0], ctx({ aliases: new Map([[key, "SKU-GB-150"]]) }));
    expect(r.skuId).toBe("SKU-GB-150");
    expect(r.level).toBe("high");
    expect(r.reason).toBe("learned");
  });

  it("uses what the shop usually orders to break a tie", () => {
    const r = matchLine(line("2 peti biscuit"), ctx({ history: new Map([["SKU-BS-200", 9]]) }));
    expect(r.skuId).toBe("SKU-BS-200");
  });
});

describe("confidence is honest", () => {
  it("never says high when several products fit equally", () => {
    const r = matchLine(line("3 peti biscuit"), ctx());
    expect(r.level).not.toBe("high");
    expect(r.alternatives).toHaveLength(2);
  });

  it("returns nothing for a product it does not stock, but still offers two choices", () => {
    const r = matchLine(line("2 peti pepsi"), ctx());
    expect(r.skuId).toBeNull();
    expect(r.level).toBe("low");
    expect(r.reason).toBe("none");
    expect(r.alternatives).toHaveLength(2);
  });

  it("prefers the matching pack size over a different one", () => {
    expect(matchLine(line("1 peti surf 500 g"), ctx()).skuId).toBe("SKU-DT-500");
    expect(matchLine(line("1 peti surf 1 kilo"), ctx()).skuId).toBe("SKU-DT-1KG");
  });

  it("a wrong pack size lowers confidence rather than being ignored", () => {
    // no 2 kg detergent exists
    const r = matchLine(line("1 peti surf 2 kilo"), ctx());
    expect(r.level).not.toBe("high");
  });

  it("understands Hindi product names", () => {
    expect(matchLine(line("३ पेटी नमक"), ctx()).skuId).toBe("SKU-SA-1KG");
    expect(matchLine(line("2 peti sabun"), ctx()).skuId).toBe("SKU-SP-100");
  });

  it("copes with a typo", () => {
    expect(matchLine(line("2 peti biscuet cream"), ctx()).skuId).toBe("SKU-BS-200");
  });
});

describe("shouldLearnAlias", () => {
  const base = {
    aliasKey: "biscuit ~small",
    suggestedSkuId: "A",
    suggestedLevel: "medium" as const,
    chosenSkuId: "A",
    suggestedOutOfStock: false,
  };

  it("learns when the shopkeeper corrects a guess", () => {
    expect(shouldLearnAlias({ ...base, chosenSkuId: "B" })).toBe(true);
  });

  it("learns when the shopkeeper confirms a line the matcher was unsure about", () => {
    expect(shouldLearnAlias({ ...base, suggestedLevel: "medium" })).toBe(true);
    expect(shouldLearnAlias({ ...base, suggestedLevel: "low", suggestedSkuId: null, chosenSkuId: "B" })).toBe(true);
  });

  it("does not learn what it already got right and sure", () => {
    expect(shouldLearnAlias({ ...base, suggestedLevel: "high" })).toBe(false);
  });

  it("does not learn a swap away from an out-of-stock product (a substitution, not a habit)", () => {
    expect(shouldLearnAlias({ ...base, chosenSkuId: "B", suggestedOutOfStock: true, suggestedLevel: "high" })).toBe(false);
  });

  it("still learns when the product was fine and the shopkeeper chose differently", () => {
    expect(shouldLearnAlias({ ...base, chosenSkuId: "B", suggestedOutOfStock: false, suggestedLevel: "high" })).toBe(true);
  });

  it("ignores empty or oversized phrases", () => {
    expect(shouldLearnAlias({ ...base, aliasKey: "", chosenSkuId: "B" })).toBe(false);
    expect(shouldLearnAlias({ ...base, aliasKey: "x".repeat(81), chosenSkuId: "B" })).toBe(false);
  });
});

describe("the AI's suggestion is evidence, not an instruction", () => {
  it("lifts a candidate it agrees with", () => {
    const base = matchLine(line("3 peti biscuit"), ctx());
    const hinted = matchLine(line("3 peti biscuit", { llmCodes: ["SKU-BS-200"] }), ctx());
    expect(hinted.skuId).toBe("SKU-BS-200");
    expect(hinted.score).toBeGreaterThanOrEqual(base.score);
  });

  it("cannot make an unrelated product look certain", () => {
    // the AI claims noodles for 'surf'; the words say detergent
    const r = matchLine(line("2 peti surf", { llmCodes: ["SKU-NM-070"] }), ctx());
    expect(["SKU-DT-1KG", "SKU-DT-500"]).toContain(r.skuId);
    expect(r.level).not.toBe("high");
  });

  it("ignores a code that is not in the catalogue", () => {
    const r = matchLine(line("2 peti surf 1 kilo", { llmCodes: ["SKU-FAKE"] }), ctx());
    expect(r.skuId).toBe("SKU-DT-1KG");
  });
});
