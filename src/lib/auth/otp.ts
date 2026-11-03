import { db } from "@/lib/db";
import { sessionSecret, testOtpFor } from "./env";
import { OTP_TTL_MS, evaluateOtp, generateCode, hashCode } from "./otp-core";
import { consume } from "./rate-limit";
import { getSmsSender } from "./sms";

const WINDOW = 10 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;

export type RequestResult =
  | { status: "sent" }
  | { status: "cooldown"; retryAfterSec: number }
  | { status: "rate_limited"; retryAfterSec: number }
  | { status: "send_failed" };

/**
 * Issues a code. Unknown numbers get the same "sent" answer as registered ones,
 * so the endpoint cannot be used to discover which shops are customers.
 */
export async function requestOtp(phone: string, ip: string): Promise<RequestResult> {
  const byPhone = await consume(`otp:phone:${phone}`, 3, WINDOW);
  if (!byPhone.allowed) return { status: "rate_limited", retryAfterSec: byPhone.retryAfterSec };
  const byIp = await consume(`otp:ip:${ip}`, 10, WINDOW);
  if (!byIp.allowed) return { status: "rate_limited", retryAfterSec: byIp.retryAfterSec };

  const retailerUser = await db.user.findFirst({
    where: { role: "RETAILER", retailer: { phone } },
    select: { id: true },
  });
  if (!retailerUser) return { status: "sent" };

  const last = await db.otpChallenge.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const wait = last.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
    if (wait > 0) return { status: "cooldown", retryAfterSec: Math.ceil(wait / 1000) };
  }

  const testCode = testOtpFor(phone);
  const code = testCode ?? generateCode();

  // A new code invalidates any earlier unused one.
  await db.otpChallenge.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const challenge = await db.otpChallenge.create({
    data: {
      phone,
      codeHash: hashCode(sessionSecret(), phone, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  if (!testCode) {
    try {
      await getSmsSender().send(
        phone,
        `${code} is your RetailDesk login code. Valid for 5 minutes. Do not share it.`,
      );
    } catch (err) {
      console.error("OTP send failed", err instanceof Error ? err.message : err);
      await db.otpChallenge.delete({ where: { id: challenge.id } });
      return { status: "send_failed" };
    }
  }
  return { status: "sent" };
}

export type VerifyResult =
  | { ok: true; userId: string; retailerId: string }
  | { ok: false; reason: "invalid" | "rate_limited"; retryAfterSec?: number };

/** Every failure is reported as "invalid" so callers cannot tell why. */
export async function verifyOtp(phone: string, code: string, ip: string): Promise<VerifyResult> {
  const limited = await consume(`otp-verify:ip:${ip}`, 20, WINDOW);
  if (!limited.allowed) return { ok: false, reason: "rate_limited", retryAfterSec: limited.retryAfterSec };

  const challenge = await db.otpChallenge.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, reason: "invalid" };

  const verdict = evaluateOtp(challenge, hashCode(sessionSecret(), phone, code), new Date());
  if (verdict !== "ok") {
    if (verdict === "wrong") {
      await db.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return { ok: false, reason: "invalid" };
  }

  // Single use: only one concurrent request can flip consumedAt.
  const claimed = await db.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reason: "invalid" };

  const user = await db.user.findFirst({
    where: { role: "RETAILER", retailer: { phone } },
    select: { id: true, retailerId: true },
  });
  if (!user?.retailerId) return { ok: false, reason: "invalid" };
  return { ok: true, userId: user.id, retailerId: user.retailerId };
}
