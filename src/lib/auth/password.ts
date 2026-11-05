// Temporary passwords. Needs Node's crypto, so it is server-side only; the rules live in password-rules.ts.
import { randomInt } from "node:crypto";
import { validateNewPassword } from "./password-rules";

export { MIN_PASSWORD_LENGTH, validateNewPassword, type PasswordContext } from "./password-rules";

// No 0/O, 1/l/I: a temporary password is read out or copied from a screen, so it must not be misread.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** 12 characters from an unambiguous alphabet, drawn with a cryptographic random source. Always passes validateNewPassword. */
export function generateTempPassword(length = 12): string {
  for (;;) {
    let out = "";
    for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
    // Must mix letters and digits, like any password we would accept.
    if (/\d/.test(out) && /[A-Za-z]/.test(out) && validateNewPassword(out) === null) return out;
  }
}
