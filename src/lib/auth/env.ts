export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return s;
}

/**
 * Demo-only: seeded fake numbers that accept a fixed code because no SMS can
 * reach them. Off unless both variables are set; real numbers always get an SMS.
 */
export function testOtpFor(phone: string): string | null {
  const code = process.env.OTP_TEST_CODE;
  const numbers = (process.env.OTP_TEST_NUMBERS ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return code && /^\d{6}$/.test(code) && numbers.includes(phone) ? code : null;
}
