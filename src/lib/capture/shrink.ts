/** The longest side of a photo sent for reading. Enough to read handwriting, small enough for slow 3G. */
export const PHOTO_MAX_SIDE = 1280;

/**
 * Shrinks a photo on the phone before it is sent: a camera picture of 3-8 MB becomes about 150-300 KB,
 * which uploads in a few seconds on 3G. The phone's own rotation is applied. Throws if the file is not
 * a picture the browser can open.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff"; // a see-through PNG becomes white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82),
    );
  } finally {
    bitmap.close();
  }
}
