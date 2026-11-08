import sharp from "sharp";

export const PHOTO_SIZE = 480;

/**
 * Resize any photo to a white-backed square WebP. A phone shows it at 150-200 px, so 480 stays sharp
 * on a 2x screen while the file stays near 10 KB, which is what makes it fast on 3G.
 */
export async function toProductPhoto(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // honour the phone's orientation flag
    .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 78, effort: 5 })
    .toBuffer();
}
