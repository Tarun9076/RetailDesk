import "server-only";
import { db } from "@/lib/db";

export interface CreditPosition {
  limitPaise: number;
  outstandingPaise: number; // balance from the accounts (Tally)
  openOrdersPaise: number; // placed or confirmed but not yet exported to Tally
  usedPaise: number;
  availablePaise: number; // can be negative
}

/**
 * Credit used = ledger outstanding + orders the desk has not exported yet.
 * Counting open orders stops a retailer from placing several orders that are
 * each under the limit but together over it. Orders on hold are not counted:
 * they are not committed until the desk releases them.
 */
export async function getCreditPosition(retailerId: string): Promise<CreditPosition> {
  const [retailer, open] = await Promise.all([
    db.retailer.findUniqueOrThrow({
      where: { id: retailerId },
      select: { creditLimitPaise: true, outstandingPaise: true },
    }),
    db.order.aggregate({
      where: { retailerId, status: { in: ["PLACED", "CONFIRMED"] } },
      _sum: { totalPaise: true },
    }),
  ]);
  const openOrdersPaise = open._sum.totalPaise ?? 0;
  const usedPaise = retailer.outstandingPaise + openOrdersPaise;
  return {
    limitPaise: retailer.creditLimitPaise,
    outstandingPaise: retailer.outstandingPaise,
    openOrdersPaise,
    usedPaise,
    availablePaise: retailer.creditLimitPaise - usedPaise,
  };
}
