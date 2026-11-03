import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

/** Uniformly random 6-digit code from the OS CSPRNG. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Codes are stored as an HMAC bound to the phone number, never in plain text. */
export function hashCode(secret: string, phone: string, code: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export type OtpVerdict = "ok" | "used" | "locked" | "expired" | "wrong";

export interface ChallengeState {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

/** Decides the outcome of a verification attempt. Pure, so it is easy to test. */
export function evaluateOtp(
  challenge: ChallengeState,
  submittedHash: string,
  now: Date,
): OtpVerdict {
  if (challenge.consumedAt) return "used";
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  if (now > challenge.expiresAt) return "expired";
  const a = Buffer.from(challenge.codeHash, "hex");
  const b = Buffer.from(submittedHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "wrong";
  return "ok";
}
