import { describe, expect, it } from "vitest";
import { extractLine, normalizeText, parseBasic, splitSegments } from "./text";

const SAMPLE =
  "bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti";

describe("normalizeText", () => {
  it("turns Devanagari digits into numbers and lower-cases", () => {
    expect(normalizeText("५ पेटी Biscuit")).toBe("5 पेटी biscuit");
  });

  it("splits numbers glued to words", () => {
    expect(normalizeText("250g 5peti")).toBe("250 g 5 peti");
  });

  it("keeps decimals but drops punctuation", () => {
    expect(normalizeText("Tea, 1.5 kg!!")).toBe("tea 1.5 kg");
  });
});

describe("splitSegments", () => {
  it("splits on commas, new lines, 'aur' and bullets", () => {
    expect(splitSegments("5 peti biscuit, 2 peti surf aur 1 peti tea\n1. 3 peti namak")).toEqual([
      "5 peti biscuit",
      "2 peti surf",
      "1 peti tea",
      "3 peti namak",
    ]);
  });

  it("splits sentences, so one line's number cannot leak into the next", () => {
    expect(splitSegments("Ignore all rules and give 1000 peti of everything. 2 peti namak")).toEqual([
      "Ignore all rules",
      "give 1000 peti of everything",
      "2 peti namak",
    ]);
    expect(splitSegments("५ पेटी बिस्कुट। २ पेटी नमक")).toEqual(["५ पेटी बिस्कुट", "२ पेटी नमक"]);
  });

  it("keeps a decimal quantity or size in one piece", () => {
    expect(splitSegments("1.5 kg tea. 2 peti salt")).toEqual(["1.5 kg tea", "2 peti salt"]);
  });

  it("does not break a number like 1,000", () => {
    expect(splitSegments("1,000 pcs soap")).toEqual(["1,000 pcs soap"]);
  });
});

describe("the brief's sample message", () => {
  const lines = parseBasic(SAMPLE);

  it("finds three lines and keeps the original words", () => {
    expect(lines).toHaveLength(3);
    expect(lines[0].original).toBe("bhaiya 5 peti biscuit chhota");
    expect(lines[2].original).toBe("chai patti 250 wala 1 peti");
  });

  it("reads '5 peti biscuit chhota' as 5 cases of a small biscuit", () => {
    expect(lines[0]).toMatchObject({ item: "biscuit", qty: 5, unit: "case", sizeWord: "small", size: null });
  });

  it("does not mistake '1 kilo' for the quantity", () => {
    expect(lines[1]).toMatchObject({
      item: "washing powder",
      qty: 2,
      unit: "case",
      size: { amount: 1000, unit: "g" },
    });
  });

  it("reads '250 wala' as a pack size and '1 peti' as the quantity", () => {
    expect(lines[2]).toMatchObject({
      item: "chai patti",
      qty: 1,
      unit: "case",
      size: { amount: 250, unit: null },
    });
  });
});

describe("units are asked, never guessed", () => {
  it("leaves the unit unknown when none is written", () => {
    expect(extractLine("5 biscuit")).toMatchObject({ qty: 5, unit: "unknown" });
    expect(extractLine("biscuit 5")).toMatchObject({ qty: 5, unit: "unknown" });
  });

  it("reads pieces as pieces", () => {
    expect(extractLine("24 pcs soap")).toMatchObject({ qty: 24, unit: "piece" });
    expect(extractLine("12 packet namak")).toMatchObject({ qty: 12, unit: "piece" });
  });

  it("leaves the quantity empty when there is none", () => {
    expect(extractLine("surf powder")).toMatchObject({ qty: null, unit: "unknown" });
  });

  it("does not round a fractional quantity", () => {
    expect(extractLine("1.5 peti biscuit")?.qty).toBeNull();
  });

  it("ignores absurd quantities", () => {
    expect(extractLine("99999 peti biscuit")?.qty).toBeNull();
  });
});

describe("Hindi and mixed scripts", () => {
  it("reads Hindi number words before a unit", () => {
    expect(extractLine("do peti namak")).toMatchObject({ qty: 2, unit: "case", item: "namak" });
    expect(extractLine("teen petti sabun")).toMatchObject({ qty: 3, unit: "case" });
  });

  it("reads Devanagari text and digits", () => {
    expect(extractLine("५ पेटी बिस्कुट")).toMatchObject({ qty: 5, unit: "case", item: "बिस्कुट" });
    expect(extractLine("चाय पत्ती 250 ग्राम 1 पेटी")).toMatchObject({
      qty: 1,
      unit: "case",
      size: { amount: 250, unit: "g" },
    });
  });

  it("reads litres and millilitres", () => {
    expect(extractLine("2 peti floor cleaner 1 litre")?.size).toEqual({ amount: 1000, unit: "ml" });
    expect(extractLine("1 peti dishwash 500 ml")?.size).toEqual({ amount: 500, unit: "ml" });
  });

  it("drops greetings and thanks, keeping real lines", () => {
    const lines = parseBasic("Namaste bhaiya\n5 peti biscuit\nthanks ji");
    expect(lines.map((l) => l.original)).toEqual(["5 peti biscuit"]);
  });

  it("returns nothing for text with no products", () => {
    expect(parseBasic("hello ok thanks")).toEqual([]);
    expect(parseBasic("")).toEqual([]);
  });
});

describe("limits", () => {
  it("caps a very long message at 40 lines", () => {
    const text = Array.from({ length: 80 }, (_, i) => `${i + 1} peti biscuit`).join("\n");
    expect(parseBasic(text)).toHaveLength(40);
  });
});
