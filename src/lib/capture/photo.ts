import type { PhotoInput } from "./gemini";

/** Large enough for a phone photo after the browser has shrunk it; far below the host's 4.5 MB body limit. */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/**
 * What kind of picture these bytes really are, judged by the first few bytes and not by the file name
 * or the type the browser claims. Anything else (a PDF, a script renamed to .jpg) is refused.
 */
export function sniffImage(bytes: Uint8Array): PhotoInput["mimeType"] | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
