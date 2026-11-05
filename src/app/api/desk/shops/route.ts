import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { normalisePhone } from "@/lib/auth/phone";
import { isPhoneTaken } from "@/lib/auth/phone-taken";
import { db } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

// Rupees in, paise stored. Whole rupees are enough for a limit and an opening balance.
const Body = z.object({
  shopName: z.string().trim().min(2).max(100),
  ownerName: z.string().trim().min(2).max(80),
  phone: z.string().min(10).max(20),
  city: z.string().trim().min(2).max(80),
  creditLimitRupees: z.number().int().min(0).max(100_000_000),
  outstandingRupees: z.number().int().min(0).max(100_000_000).default(0),
  salesmanId: z.string().min(1).max(40).nullable().optional(),
});

/** The desk adds a shop. The owner can sign in at once with an SMS code on this number. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;

  const phone = normalisePhone(d.phone);
  if (!phone) return json({ error: "invalid_phone" }, 422);
  if (await isPhoneTaken(phone)) return json({ error: "phone_taken" }, 409);

  if (d.salesmanId) {
    const s = await db.user.findFirst({ where: { id: d.salesmanId, role: "SALESMAN", active: true }, select: { id: true } });
    if (!s) return json({ error: "unknown_salesman" }, 422);
  }

  try {
    const shop = await db.retailer.create({
      data: {
        name: d.ownerName,
        shopName: d.shopName,
        phone,
        city: d.city,
        creditLimitPaise: d.creditLimitRupees * 100,
        outstandingPaise: d.outstandingRupees * 100,
        tallyLedgerName: d.shopName,
        salesmanId: d.salesmanId ?? null,
        users: { create: { role: "RETAILER", name: d.ownerName } },
        events: {
          create: {
            kind: "SHOP_CREATED",
            byName: user.name,
            summary: `Shop added with credit limit ₹${d.creditLimitRupees.toLocaleString("en-IN")}`,
          },
        },
      },
      select: { id: true },
    });
    return json({ id: shop.id }, 201);
  } catch {
    return json({ error: "phone_taken" }, 409);
  }
}
