import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { revocationCutoff } from "@/lib/auth/session-rules";
import { normalisePhone } from "@/lib/auth/phone";
import { isPhoneTaken } from "@/lib/auth/phone-taken";
import { db } from "@/lib/db";
import type { z } from "zod";
import { describeShopChange, type ShopPatch } from "./rules";

export type UpdateShopResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "not_found" | "invalid_phone" | "phone_taken" | "ledger_taken" | "unknown_salesman" };

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * Edits a shop: its details, credit limit, the amount it owes, its Tally name,
 * its salesman, and whether it is switched on. Everything that changes is written
 * to the shop's history. Changing the mobile number or switching a shop off
 * signs its owner out at once, wherever they are signed in.
 */
export async function updateShop(id: string, input: z.infer<typeof ShopPatch>, byName: string): Promise<UpdateShopResult> {
  const phone = normalisePhone(input.phone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  const before = await db.retailer.findUnique({ where: { id }, include: { salesman: { select: { name: true } } } });
  if (!before) return { ok: false, reason: "not_found" };

  if (phone !== before.phone && (await isPhoneTaken(phone))) return { ok: false, reason: "phone_taken" };

  const ledger = input.tallyLedgerName?.trim() || null;
  if (ledger) {
    // Two shops under one Tally party would post their sales to the same account.
    const clash = await db.retailer.findFirst({
      where: { id: { not: id }, tallyLedgerName: { equals: ledger, mode: "insensitive" } },
      select: { id: true },
    });
    if (clash) return { ok: false, reason: "ledger_taken" };
  }

  let salesmanName: string | null = null;
  if (input.salesmanId) {
    const s = await db.user.findFirst({ where: { id: input.salesmanId, role: "SALESMAN", active: true }, select: { name: true } });
    if (!s) return { ok: false, reason: "unknown_salesman" };
    salesmanName = s.name;
  }

  const beforeFields = {
    shopName: before.shopName,
    name: before.name,
    phone: before.phone,
    city: before.city,
    creditLimitPaise: before.creditLimitPaise,
    outstandingPaise: before.outstandingPaise,
    tallyLedgerName: before.tallyLedgerName,
    salesmanName: before.salesman?.name ?? null,
    active: before.active,
  };
  const afterFields = {
    shopName: input.shopName,
    name: input.ownerName,
    phone,
    city: input.city,
    creditLimitPaise: input.creditLimitPaise,
    outstandingPaise: input.outstandingPaise,
    tallyLedgerName: ledger,
    salesmanName,
    active: input.active,
  };
  const changes = describeShopChange(beforeFields, afterFields);
  if (changes.length === 0) return { ok: true, changed: false };

  try {
    await db.$transaction(async (tx) => {
      await tx.retailer.update({
        where: { id },
        data: {
          shopName: input.shopName,
          name: input.ownerName,
          phone,
          city: input.city,
          creditLimitPaise: input.creditLimitPaise,
          outstandingPaise: input.outstandingPaise,
          tallyLedgerName: ledger,
          salesmanId: input.salesmanId,
          active: input.active,
        },
      });
      // A new number, or a shop switched off: whoever is signed in as this shop is signed out now.
      if (phone !== before.phone || (before.active && !input.active)) {
        await tx.user.updateMany({ where: { retailerId: id }, data: { sessionsValidFrom: revocationCutoff() } });
      }
      const kind = before.active && !input.active ? "SHOP_SWITCHED_OFF" : !before.active && input.active ? "SHOP_SWITCHED_ON" : "SHOP_UPDATED";
      await tx.shopEvent.create({ data: { retailerId: id, kind, summary: changes.join("; "), byName } });
    });
  } catch (e) {
    if (isUnique(e)) return { ok: false, reason: "phone_taken" };
    throw e;
  }
  return { ok: true, changed: true };
}
