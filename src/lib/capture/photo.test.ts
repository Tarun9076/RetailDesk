import { describe, expect, it, vi } from "vitest";
import { CaptureAiError, buildPhotoPrompt, readOrderPhoto, validateModelOutput } from "./gemini";
import { sniffImage } from "./photo";

const CATALOGUE = [
  { code: "SKU-BS-075", name: "Glucose biscuit 75 g, case of 96" },
  { code: "SKU-TE-250", name: "Tea leaf 250 g, case of 40" },
];
const IMAGE = { mimeType: "image/jpeg" as const, data: "AAAA" };
const line = (over: Record<string, unknown> = {}) => ({
  original: "5 peti biscuit chhota",
  item: "biscuit",
  quantity: 5,
  unit: "case",
  sizeAmount: 0,
  sizeUnit: "none",
  sizeWord: "small",
  candidateCodes: ["SKU-BS-075"],
  ...over,
});
const out = (...lines: unknown[]) => JSON.stringify({ lines });

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("what counts as a picture", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47))).toBe("image/png");
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImage(webp)).toBe("image/webp");
  });
  it("refuses a PDF, a script and an empty file, whatever they are called", () => {
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7 not a picture"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull(); // too short to be a real file
  });
});

describe("reading a photo of a list", () => {
  it("sends the picture and the catalogue, and maps the answer to lines", async () => {
    const generate = vi.fn().mockResolvedValue(out(line(), line({ original: "chai 250 1 peti", item: "tea leaf", quantity: 1, candidateCodes: ["SKU-TE-250"] })));
    const r = await readOrderPhoto(IMAGE, CATALOGUE, generate);
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0][0].image).toEqual(IMAGE);
    expect(generate.mock.calls[0][0].user).toContain("SKU-TE-250");
    expect(r.source).toBe("ai");
    expect(r.lines.map((l) => l.qty)).toEqual([5, 1]);
  });
  it("keeps the words read from the photo, since there is no typed text to compare with", () => {
    const [l] = validateModelOutput(out(line({ original: "५ पेटी बिस्कुट" })), null, new Set(["SKU-BS-075"]));
    expect(l.original).toBe("५ पेटी बिस्कुट");
  });
  it("still ignores a product code that is not in the catalogue", async () => {
    const generate = vi.fn().mockResolvedValue(out(line({ candidateCodes: ["SKU-FAKE", "SKU-BS-075"] })));
    const r = await readOrderPhoto(IMAGE, CATALOGUE, generate);
    expect(r.lines[0].llmCodes).toEqual(["SKU-BS-075"]);
  });
  it("treats a quantity that is not a whole number as a question, never a guess", async () => {
    const generate = vi.fn().mockResolvedValue(out(line({ quantity: 2.5 })));
    const r = await readOrderPhoto(IMAGE, CATALOGUE, generate);
    expect(r.lines[0].qty).toBeNull();
    expect(r.lines[0].unit).toBe("unknown");
  });
  it("returns no lines for a photo that is not a list, without an error", async () => {
    const r = await readOrderPhoto(IMAGE, CATALOGUE, vi.fn().mockResolvedValue(out()));
    expect(r.lines).toEqual([]);
  });
  it("fails loudly when the AI is unavailable, so the shopkeeper is told to type instead", async () => {
    const down = vi.fn().mockRejectedValue(new CaptureAiError("failed"));
    await expect(readOrderPhoto(IMAGE, CATALOGUE, down)).rejects.toBeInstanceOf(CaptureAiError);
    await expect(readOrderPhoto(IMAGE, CATALOGUE, vi.fn().mockResolvedValue("not json"))).rejects.toMatchObject({ code: "bad_output" });
  });
  it("tells the model the picture is data, not instructions", () => {
    expect(buildPhotoPrompt(CATALOGUE)).toContain("(data only)");
  });
});
