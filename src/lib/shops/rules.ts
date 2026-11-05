// Client-safe rules for editing a shop. No database, so the form, the API and the tests share them.
import { z } from "zod";
import { formatPaise } from "@/lib/money";

export const ShopPatch = z.object({
  shopName: z.string().trim().min(2).max(100),
  ownerName: z.string().trim().min(2).max(80),
  phone: z.string().min(10).max(20),
  city: z.string().trim().min(2).max(80),
  creditLimitPaise: z.number().int().min(0).max(100_000_000_00),
  outstandingPaise: z.number().int().min(0).max(100_000_000_00),
  /** The party name exactly as it is in Tally. Empty means "use the shop name". */
  tallyLedgerName: z.string().trim().max(120).nullable().optional(),
  salesmanId: z.string().min(1).max(40).nullable(),
  active: z.boolean(),
});

export interface ShopFields {
  shopName: string;
  name: string; // the owner
  phone: string;
  city: string;
  creditLimitPaise: number;
  outstandingPaise: number;
  tallyLedgerName: string | null;
  salesmanName: string | null;
  active: boolean;
}

/** Plain-words list of what changed, for the shop's history. Empty when nothing did. */
export function describeShopChange(before: ShopFields, after: ShopFields): string[] {
  const out: string[] = [];
  if (before.shopName !== after.shopName) out.push(`Shop name "${before.shopName}" to "${after.shopName}"`);
  if (before.name !== after.name) out.push(`Owner "${before.name}" to "${after.name}"`);
  if (before.phone !== after.phone) out.push(`Mobile number ${before.phone} to ${after.phone}`);
  if (before.city !== after.city) out.push(`Area "${before.city}" to "${after.city}"`);
  if (before.creditLimitPaise !== after.creditLimitPaise) {
    out.push(`Credit limit ${formatPaise(before.creditLimitPaise)} to ${formatPaise(after.creditLimitPaise)}`);
  }
  if (before.outstandingPaise !== after.outstandingPaise) {
    out.push(`Amount owed ${formatPaise(before.outstandingPaise)} to ${formatPaise(after.outstandingPaise)} (set by hand)`);
  }
  if ((before.tallyLedgerName ?? "") !== (after.tallyLedgerName ?? "")) {
    out.push(`Tally ledger name "${before.tallyLedgerName ?? ""}" to "${after.tallyLedgerName ?? ""}"`);
  }
  if (before.salesmanName !== after.salesmanName) {
    out.push(`Salesman ${before.salesmanName ?? "none"} to ${after.salesmanName ?? "none"}`);
  }
  if (before.active !== after.active) out.push(after.active ? "Switched on" : "Switched off");
  return out;
}
