import { describe, expect, it } from "vitest";
import { formatPriceShort } from "./money";
import {
  PACK_COLOURS,
  packColourFor,
  packKindFor,
  packLabelFor,
  packSizeFrom,
  safeImageUrl,
  splitProductName,
} from "./product-look";

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe("what a product looks like", () => {
  it("draws the right kind of pack from the name", () => {
    expect(packKindFor("Cream biscuit 200 g, case of 48")).toBe("carton");
    expect(packKindFor("Instant noodles 70 g, case of 48")).toBe("pouch");
    expect(packKindFor("Tea leaf 250 g, case of 40")).toBe("pouch");
    expect(packKindFor("Iodised salt 1 kg, case of 25")).toBe("pouch");
    expect(packKindFor("Detergent powder 1 kg, case of 20")).toBe("tub");
    expect(packKindFor("Dishwash liquid 500 ml, case of 24")).toBe("bottle");
    expect(packKindFor("Floor cleaner 1 l, case of 12")).toBe("bottle");
    expect(packKindFor("Bath soap 100 g, case of 72")).toBe("bar");
  });
  it("falls back to a plain carton for a name it does not know", () => {
    expect(packKindFor("Mystery item")).toBe("carton");
  });
  it("reads the pack size from the name", () => {
    expect(packSizeFrom("Cream biscuit 200 g, case of 48")).toBe("200 g");
    expect(packSizeFrom("Floor cleaner 1 l")).toBe("1 l");
    expect(packSizeFrom("Dishwash liquid 500 ML")).toBe("500 ml");
    expect(packSizeFrom("Tea leaf 2.5 kg")).toBe("2.5 kg");
    expect(packSizeFrom("Mystery item")).toBeNull();
  });
});

describe("the colours of the packs", () => {
  it("every colour holds white text at 4.5:1 or better", () => {
    for (const c of PACK_COLOURS) expect(contrastWithWhite(c), c).toBeGreaterThanOrEqual(4.5);
  });
  it("a product line always gets the same colour, whatever its size", () => {
    expect(packColourFor("Annapurna Foods", "Cream biscuit 200 g, case of 48")).toBe(
      packColourFor("Annapurna Foods", "Cream biscuit 48 g, case of 96"),
    );
  });
  it("is deterministic and always one of the restrained palette", () => {
    const c = packColourFor("SafaiPlus", "Detergent powder 1 kg");
    expect(c).toBe(packColourFor("SafaiPlus", "Detergent powder 1 kg"));
    expect(PACK_COLOURS).toContain(c);
  });
  it("spreads different lines across the palette, so neighbours are rarely twins", () => {
    const names = ["Cream biscuit", "Glucose biscuit", "Instant noodles", "Iodised salt", "Tea leaf", "Detergent powder", "Dishwash liquid", "Floor cleaner", "Bath soap"];
    const used = new Set(names.map((n) => packColourFor("Annapurna Foods", `${n} 100 g`)));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
  it("puts only the brand's first word on the pack, short and in capitals", () => {
    expect(packLabelFor("Annapurna Foods")).toBe("ANNAPURNA");
    expect(packLabelFor("SafaiPlus")).toBe("SAFAIPLUS");
    expect(packLabelFor("Extraordinarilylongbrandname Co")).toHaveLength(11);
  });
});

describe("names and prices on a card", () => {
  it("splits a long name into a title and a quiet detail", () => {
    expect(splitProductName("Cream biscuit 200 g, case of 48")).toEqual({ title: "Cream biscuit 200 g", detail: "case of 48" });
    expect(splitProductName("Simple name")).toEqual({ title: "Simple name", detail: "" });
    expect(splitProductName("a, b, c")).toEqual({ title: "a", detail: "b, c" });
  });
  it("drops .00 from a whole-rupee price and keeps paise otherwise", () => {
    expect(formatPriceShort(144000)).toBe("₹1,440");
    expect(formatPriceShort(75840)).toBe("₹758.40");
    expect(formatPriceShort(100)).toBe("₹1");
    expect(formatPriceShort(5)).toBe("₹0.05");
    expect(formatPriceShort(12345600)).toBe("₹1,23,456");
  });
});

describe("a photo address", () => {
  it("accepts https only", () => {
    expect(safeImageUrl("https://example.com/rice.png")).toBe("https://example.com/rice.png");
    expect(safeImageUrl("http://example.com/rice.png")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(safeImageUrl("not a url")).toBeNull();
    expect(safeImageUrl("")).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
  });
  it("refuses an address that is too long", () => {
    expect(safeImageUrl("https://example.com/" + "a".repeat(400))).toBeNull();
  });
});

describe("the app's own photos", () => {
  it("accepts a resized photo kept on the app's own domain", () => {
    expect(safeImageUrl("/products/SKU-BS-075-1a2b3c4d.webp")).toBe("/products/SKU-BS-075-1a2b3c4d.webp");
  });
  it("refuses paths that climb out, other folders and odd file types", () => {
    expect(safeImageUrl("/products/../secret.webp")).toBeNull();
    expect(safeImageUrl("/other/a.webp")).toBeNull();
    expect(safeImageUrl("/products/a.svg")).toBeNull();
    expect(safeImageUrl("//evil.com/a.webp")).toBeNull();
  });
});
