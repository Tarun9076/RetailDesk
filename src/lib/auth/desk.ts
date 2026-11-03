import argon2 from "argon2";
import { db } from "@/lib/db";
import { clearHits, isBlocked, recordHit } from "./rate-limit";

const WINDOW = 15 * 60_000;

// Verified against when the email is unknown, so response time does not reveal it.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= argon2.hash("not-a-real-password"));

export type DeskLoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "rate_limited"; retryAfterSec?: number };

export async function loginDesk(
  email: string,
  password: string,
  ip: string,
): Promise<DeskLoginResult> {
  const emailKey = `desk:email:${email}`;
  const ipKey = `desk:ip:${ip}`;

  // Only failures count towards the limits.
  const [byEmail, byIp] = await Promise.all([
    isBlocked(emailKey, 5, WINDOW),
    isBlocked(ipKey, 20, WINDOW),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSec: Math.max(byEmail.retryAfterSec, byIp.retryAfterSec),
    };
  }

  const user = await db.user.findFirst({ where: { role: "DESK", email } });
  const hash = user?.passwordHash ?? (await getDummyHash());
  const valid = await argon2.verify(hash, password).catch(() => false);

  if (!user || !valid) {
    await Promise.all([recordHit(emailKey), recordHit(ipKey)]);
    return { ok: false, reason: "invalid" };
  }
  await clearHits(emailKey);
  return { ok: true, userId: user.id };
}
