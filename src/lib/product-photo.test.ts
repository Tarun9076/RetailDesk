import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PHOTO_SIZE, toProductPhoto } from "./product-photo";

const wide = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.5 } } }).png().toBuffer();

describe("product photo resizing", () => {
  it("makes a square WebP of the standard size from a wide photo", async () => {
    const out = await toProductPhoto(await wide(3000, 1500));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(PHOTO_SIZE);
    expect(meta.height).toBe(PHOTO_SIZE);
  });
  it("keeps a large photo small enough for slow 3G", async () => {
    const out = await toProductPhoto(await wide(4000, 4000));
    expect(out.length).toBeLessThan(30 * 1024);
  });
  it("puts see-through areas on white, not black", async () => {
    const out = await toProductPhoto(await wide(600, 600));
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(200); // a corner pixel is light
  });
});
