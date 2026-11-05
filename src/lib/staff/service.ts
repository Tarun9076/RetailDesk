import "server-only";
import argon2 from "argon2";
import { Prisma } from "@/generated/prisma/client";
import { clearHits, isBlocked, recordHit } from "@/lib/auth/rate-limit";
import { generateTempPassword, validateNewPassword } from "@/lib/auth/password";
import { revocationCutoff } from "@/lib/auth/session-rules";
import { db } from "@/lib/db";

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

const log = (tx: Prisma.TransactionClient, userId: string, kind: string, summary: string, byName: string) =>
  tx.staffEvent.create({ data: { userId, kind, summary, byName } });

/**
 * Adds a desk account with a temporary password that is shown once. It opens only
 * the "choose your own password" screen, so whoever relays it cannot use it for anything else.
 */
export async function addStaff(input: { name: string; email: string }, byName: string) {
  const email = input.email.trim().toLowerCase();
  const tempPassword = generateTempPassword();
  const passwordHash = await argon2.hash(tempPassword);
  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { role: "DESK", name: input.name.trim(), email, passwordHash, mustChangePassword: true },
        select: { id: true },
      });
      await log(tx, u.id, "STAFF_ADDED", `Account created for ${email}`, byName);
      return u;
    });
    return { ok: true as const, id: user.id, email, tempPassword };
  } catch (e) {
    if (isUnique(e)) return { ok: false as const, reason: "email_taken" as const };
    throw e;
  }
}

/** Gives a colleague a new temporary password and signs them out everywhere. They must choose their own at next sign-in. */
export async function resetStaffPassword(id: string, byName: string) {
  const target = await db.user.findFirst({ where: { id, role: "DESK" }, select: { id: true, email: true } });
  if (!target) return { ok: false as const, reason: "not_found" as const };
  const tempPassword = generateTempPassword();
  const passwordHash = await argon2.hash(tempPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, sessionsValidFrom: revocationCutoff() },
    });
    await log(tx, id, "PASSWORD_RESET", "Temporary password issued; signed out everywhere", byName);
  });
  return { ok: true as const, email: target.email, tempPassword };
}

export type StaffActiveResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "self" | "last_active" };

/** Switch a colleague off or on. You cannot switch yourself off, and the last active account can never be switched off. */
export async function setStaffActive(id: string, active: boolean, actor: { id: string; name: string }): Promise<StaffActiveResult> {
  if (!active && id === actor.id) return { ok: false, reason: "self" };
  return db.$transaction(async (tx): Promise<StaffActiveResult> => {
    const target = await tx.user.findFirst({ where: { id, role: "DESK" }, select: { id: true, active: true, email: true } });
    if (!target) return { ok: false, reason: "not_found" };
    if (target.active === active) return { ok: true };
    if (!active) {
      const others = await tx.user.count({ where: { role: "DESK", active: true, id: { not: id } } });
      if (others === 0) return { ok: false, reason: "last_active" };
    }
    await tx.user.update({
      where: { id },
      data: { active, sessionsValidFrom: active ? undefined : revocationCutoff() },
    });
    await log(tx, id, active ? "SWITCHED_ON" : "SWITCHED_OFF", active ? "Account switched on" : "Account switched off; signed out everywhere", actor.name);
    return { ok: true };
  });
}

export type ChangePasswordResult =
  | { ok: true; cutoff: Date }
  | { ok: false; reason: "wrong_current" | "weak"; message?: string }
  | { ok: false; reason: "rate_limited"; retryAfterSec: number };

const WINDOW = 15 * 60_000;

/** A person changes their own password. The current one must be right (wrong tries are limited), and every other login of theirs is signed out. */
export async function changeOwnPassword(
  user: { id: string; email: string | null; name: string; passwordHash: string | null },
  current: string,
  next: string,
): Promise<ChangePasswordResult> {
  const key = `pwchange:${user.id}`;
  const gate = await isBlocked(key, 5, WINDOW);
  if (!gate.allowed) return { ok: false, reason: "rate_limited", retryAfterSec: gate.retryAfterSec };

  const right = user.passwordHash ? await argon2.verify(user.passwordHash, current).catch(() => false) : false;
  if (!right) {
    await recordHit(key);
    return { ok: false, reason: "wrong_current" };
  }
  const problem = validateNewPassword(next, { email: user.email ?? undefined, name: user.name, current });
  if (problem) return { ok: false, reason: "weak", message: problem };

  const passwordHash = await argon2.hash(next);
  const cutoff = revocationCutoff();
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, sessionsValidFrom: cutoff },
    });
    await log(tx, user.id, "PASSWORD_CHANGED", "Changed own password; other logins signed out", user.name);
  });
  await clearHits(key);
  return { ok: true, cutoff };
}
