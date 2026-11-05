// Client-safe password rules: no Node-only imports, so the form and the API check the same thing.
export const MIN_PASSWORD_LENGTH = 10;

/** Passwords that are common enough to be guessed first. Compared in lower case with spaces removed. */
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty", "qwertyuiop", "letmein", "welcome", "welcome1",
  "admin", "admin123", "administrator", "retaildesk", "retaildesk1", "retaildesk123", "jabalpur", "jabalpur123",
  "123456", "1234567", "12345678", "123456789", "1234567890", "0987654321", "11111111", "00000000", "abcd1234",
  "iloveyou", "monkey", "dragon", "india123", "tally123", "tallyprime",
]);

export interface PasswordContext {
  email?: string;
  name?: string;
  /** The password being replaced, so "change" cannot mean "keep". */
  current?: string;
}

/** Returns a plain-words reason the password is not acceptable, or null when it is fine. */
export function validateNewPassword(password: string, ctx: PasswordContext = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 128) return "Use at most 128 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    if (password.length < 16) return "Use letters and numbers, or make it 16 characters or longer.";
  }
  const flat = password.toLowerCase().replace(/\s+/g, "");
  if (COMMON.has(flat)) return "That password is too common. Choose something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "That password is the same character repeated.";
  if (ctx.email) {
    const local = ctx.email.toLowerCase().split("@")[0];
    if (flat === ctx.email.toLowerCase() || (local.length >= 4 && flat.includes(local))) {
      return "Do not use your email address in your password.";
    }
  }
  if (ctx.name) {
    const first = ctx.name.toLowerCase().split(/\s+/)[0];
    if (first.length >= 4 && flat === first) return "Do not use your name as your password.";
  }
  if (ctx.current !== undefined && password === ctx.current) return "The new password must be different from the old one.";
  return null;
}
