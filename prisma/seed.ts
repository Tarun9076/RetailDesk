/**
 * Demo data. Everything here is invented (assumption A8) except the three SKUs
 * and their prices/stock/schemes, which come from the client brief.
 * Re-running wipes and recreates all rows.
 */
import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Sku } from "../src/generated/prisma/client";
import { aliasKey } from "../src/lib/capture/match";
import { priceOrder } from "../src/lib/pricing/engine";
import type { SchemeRule } from "../src/lib/pricing/types";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL (or DIRECT_URL) before seeding");
const deskPassword = process.env.SEED_DESK_PASSWORD;
if (!deskPassword || deskPassword.length < 8) {
  throw new Error("Set SEED_DESK_PASSWORD (8+ characters) before seeding");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const rupees = (r: number) => Math.round(r * 100);
const DAY = 86_400_000;

// Deterministic PRNG so every seed run produces the same orders.
let state = 20261104;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

type SkuSeed = {
  code: string;
  name: string;
  nameHi: string;
  brand: string;
  piecesPerCase: number;
  price: number; // â‚¹ per piece
  gstRateBp: number;
  stockCases: number;
  scheme?: SchemeRule;
};

const SKUS: SkuSeed[] = [
  // From the brief
  { code: "SKU-BS-075", name: "Glucose biscuit 75 g, case of 96", nameHi: "à¤—à¥à¤²à¥‚à¤•à¥‹à¤œà¤¼ à¤¬à¤¿à¤¸à¥à¤•à¥à¤Ÿ 75 à¤—à¥à¤°à¤¾à¤®", brand: "Annapurna Foods", piecesPerCase: 96, price: 8.1, gstRateBp: 1200, stockCases: 340,
    scheme: { type: "FREE_GOODS", buyQty: 10, freeQty: 1, label: "Buy 10 cases get 1 free" } },
  { code: "SKU-DT-1KG", name: "Detergent powder 1 kg, case of 20", nameHi: "à¤¡à¤¿à¤Ÿà¤°à¥à¤œà¥‡à¤‚à¤Ÿ à¤ªà¤¾à¤‰à¤¡à¤° 1 à¤•à¤¿à¤²à¥‹", brand: "SafaiPlus", piecesPerCase: 20, price: 101.5, gstRateBp: 1800, stockCases: 85,
    scheme: { type: "SLAB_PERCENT", minQty: 5, percentBp: 300, label: "3% off 5 or more cases" } },
  { code: "SKU-TE-250", name: "Tea leaf 250 g, case of 40", nameHi: "à¤šà¤¾à¤¯ à¤ªà¤¤à¥à¤¤à¥€ 250 à¤—à¥à¤°à¤¾à¤®", brand: "Chaikhana Teas", piecesPerCase: 40, price: 118, gstRateBp: 1200, stockCases: 0 },
  // Invented to make the catalogue realistic
  { code: "SKU-BS-200", name: "Cream biscuit 200 g, case of 48", nameHi: "à¤•à¥à¤°à¥€à¤® à¤¬à¤¿à¤¸à¥à¤•à¥à¤Ÿ 200 à¤—à¥à¤°à¤¾à¤®", brand: "Annapurna Foods", piecesPerCase: 48, price: 30, gstRateBp: 1800, stockCases: 120 },
  { code: "SKU-GB-150", name: "Glucose biscuit 150 g, case of 48", nameHi: "à¤—à¥à¤²à¥‚à¤•à¥‹à¤œà¤¼ à¤¬à¤¿à¤¸à¥à¤•à¥à¤Ÿ 150 à¤—à¥à¤°à¤¾à¤®", brand: "Annapurna Foods", piecesPerCase: 48, price: 15, gstRateBp: 1200, stockCases: 8 },
  { code: "SKU-NM-070", name: "Instant noodles 70 g, case of 48", nameHi: "à¤‡à¤‚à¤¸à¥à¤Ÿà¥‡à¤‚à¤Ÿ à¤¨à¥‚à¤¡à¤²à¥à¤¸ 70 à¤—à¥à¤°à¤¾à¤®", brand: "Annapurna Foods", piecesPerCase: 48, price: 12, gstRateBp: 1200, stockCases: 210,
    scheme: { type: "FREE_GOODS", buyQty: 8, freeQty: 1, label: "Buy 8 cases get 1 free" } },
  { code: "SKU-SA-1KG", name: "Iodised salt 1 kg, case of 25", nameHi: "à¤†à¤¯à¥‹à¤¡à¥€à¤¨ à¤¨à¤®à¤• 1 à¤•à¤¿à¤²à¥‹", brand: "Annapurna Foods", piecesPerCase: 25, price: 24, gstRateBp: 0, stockCases: 400 },
  { code: "SKU-TE-100", name: "Tea leaf 100 g, case of 80", nameHi: "à¤šà¤¾à¤¯ à¤ªà¤¤à¥à¤¤à¥€ 100 à¤—à¥à¤°à¤¾à¤®", brand: "Chaikhana Teas", piecesPerCase: 80, price: 48, gstRateBp: 1200, stockCases: 95 },
  { code: "SKU-DT-500", name: "Detergent powder 500 g, case of 40", nameHi: "à¤¡à¤¿à¤Ÿà¤°à¥à¤œà¥‡à¤‚à¤Ÿ à¤ªà¤¾à¤‰à¤¡à¤° 500 à¤—à¥à¤°à¤¾à¤®", brand: "SafaiPlus", piecesPerCase: 40, price: 52, gstRateBp: 1800, stockCases: 140,
    scheme: { type: "SLAB_PERCENT", minQty: 10, percentBp: 200, label: "2% off 10 or more cases" } },
  { code: "SKU-DW-500", name: "Dishwash liquid 500 ml, case of 24", nameHi: "à¤¡à¤¿à¤¶à¤µà¥‰à¤¶ à¤²à¤¿à¤•à¥à¤µà¤¿à¤¡ 500 à¤®à¤¿à¤²à¥€", brand: "SafaiPlus", piecesPerCase: 24, price: 95, gstRateBp: 1800, stockCases: 60 },
  { code: "SKU-FC-1L", name: "Floor cleaner 1 l, case of 12", nameHi: "à¤«à¤¼à¤°à¥à¤¶ à¤•à¥à¤²à¥€à¤¨à¤° 1 à¤²à¥€à¤Ÿà¤°", brand: "SafaiPlus", piecesPerCase: 12, price: 140, gstRateBp: 1800, stockCases: 18 },
  { code: "SKU-SP-100", name: "Bath soap 100 g, case of 72", nameHi: "à¤¨à¤¹à¤¾à¤¨à¥‡ à¤•à¤¾ à¤¸à¤¾à¤¬à¥à¤¨ 100 à¤—à¥à¤°à¤¾à¤®", brand: "Nirmal Care", piecesPerCase: 72, price: 34, gstRateBp: 1800, stockCases: 300,
    scheme: { type: "SLAB_PERCENT", minQty: 8, percentBp: 400, label: "4% off 8 or more cases" } },
];

type RetailerSeed = {
  name: string; shopName: string; phone: string; city: string;
  creditLimit: number; outstanding: number; lastOrderDaysAgo: number; orders: number;
  priceOverrides?: Record<string, number>; // â‚¹ per piece
};

const RETAILERS: RetailerSeed[] = [
  { name: "Ramesh Gupta", shopName: "Gupta General Store", phone: "+919000000001", city: "Jabalpur - Sadar", creditLimit: 150_000, outstanding: 30_000, lastOrderDaysAgo: 2, orders: 24, priceOverrides: { "SKU-BS-075": 7.9 } },
  { name: "Sunita Yadav", shopName: "Yadav Kirana", phone: "+919000000002", city: "Jabalpur - Napier Town", creditLimit: 80_000, outstanding: 74_000, lastOrderDaysAgo: 1, orders: 18 },
  { name: "Mohd. Aslam", shopName: "Aslam Provision Store", phone: "+919000000003", city: "Jabalpur - Gohalpur", creditLimit: 100_000, outstanding: 20_000, lastOrderDaysAgo: 4, orders: 20 },
  { name: "Pooja Jain", shopName: "Jain Super Mart", phone: "+919000000004", city: "Jabalpur - Wright Town", creditLimit: 200_000, outstanding: 40_000, lastOrderDaysAgo: 3, orders: 26, priceOverrides: { "SKU-DT-1KG": 99, "SKU-BS-075": 7.95 } },
  { name: "Dinesh Patel", shopName: "Patel Kirana & General", phone: "+919000000005", city: "Jabalpur - Ranjhi", creditLimit: 60_000, outstanding: 15_000, lastOrderDaysAgo: 19, orders: 9 },
  { name: "Kavita Soni", shopName: "Soni Departmental Store", phone: "+919000000006", city: "Jabalpur - Vijay Nagar", creditLimit: 90_000, outstanding: 0, lastOrderDaysAgo: 27, orders: 6 },
  // A new shop that has signed up but never ordered: the desk should still see it.
  { name: "Rajesh Tiwari", shopName: "Tiwari Provision Store", phone: "+919000000007", city: "Jabalpur - Adhartal", creditLimit: 50_000, outstanding: 0, lastOrderDaysAgo: 0, orders: 0 },
];

const OPEN_ORDERS: Record<string, number> = {
  "+919000000001": 2,
  "+919000000003": 1,
  "+919000000004": 2,
};

async function main() {
  // wipe in dependency order
  await db.orderLine.deleteMany();
  await db.order.deleteMany();
  await db.aiCapture.deleteMany();
  await db.alias.deleteMany();
  await db.retailerPrice.deleteMany();
  await db.user.deleteMany();
  await db.retailer.deleteMany();
  await db.scheme.deleteMany();
  await db.sku.deleteMany();
  await db.otpChallenge.deleteMany();
  await db.rateLimitHit.deleteMany();

  const skuRows: { row: Sku; seed: SkuSeed }[] = [];
  for (const s of SKUS) {
    const row = await db.sku.create({
      data: {
        code: s.code, name: s.name, nameHi: s.nameHi, brand: s.brand,
        piecesPerCase: s.piecesPerCase, pricePaise: rupees(s.price),
        gstRateBp: s.gstRateBp, stockCases: s.stockCases,
        schemes: s.scheme
          ? { create: s.scheme.type === "FREE_GOODS"
              ? { type: "FREE_GOODS", buyQty: s.scheme.buyQty, freeQty: s.scheme.freeQty, label: s.scheme.label }
              : { type: "SLAB_PERCENT", minQty: s.scheme.minQty, percentBp: s.scheme.percentBp, label: s.scheme.label } }
          : undefined,
      },
    });
    skuRows.push({ row, seed: s });
  }
  const byCode = new Map(skuRows.map((x) => [x.seed.code, x]));

  await db.user.create({
    data: {
      role: "DESK", name: "Order Desk", email: "desk@retaildesk.demo",
      passwordHash: await argon2.hash(deskPassword!),
    },
  });

  let orderNo = 1;
  for (const r of RETAILERS) {
    const retailer = await db.retailer.create({
      data: {
        name: r.name, shopName: r.shopName, phone: r.phone, city: r.city,
        creditLimitPaise: rupees(r.creditLimit), outstandingPaise: rupees(r.outstanding),
        tallyLedgerName: r.shopName,
      },
    });
    await db.user.create({ data: { role: "RETAILER", name: r.name, retailerId: retailer.id } });

    const overrides = r.priceOverrides ?? {};
    for (const [code, price] of Object.entries(overrides)) {
      await db.retailerPrice.create({
        data: { retailerId: retailer.id, skuId: byCode.get(code)!.row.id, pricePaise: rupees(price) },
      });
    }

    const unitPriceOf = ({ row, seed }: (typeof skuRows)[number]) =>
      overrides[seed.code] !== undefined ? rupees(overrides[seed.code]) : row.pricePaise;

    // history: spread r.orders orders between lastOrderDaysAgo and ~45 days ago
    const inStock = skuRows.filter((x) => x.seed.stockCases > 0);
    for (let i = 0; i < r.orders; i++) {
      const daysAgo = i === 0 ? r.lastOrderDaysAgo : r.lastOrderDaysAgo + Math.round((i * 40) / r.orders) + randInt(0, 3);
      // Orders still waiting for the desk are from the last day or so, like a real queue.
      const isOpen = i < (OPEN_ORDERS[r.phone] ?? 0);
      const createdAt = isOpen
        ? new Date(Date.now() - (2 + i * 6) * 3_600_000)
        : new Date(Date.now() - daysAgo * DAY);
      const picks = [...inStock].sort(() => rand() - 0.5).slice(0, randInt(2, 4));
      const priced = priceOrder(
        picks.map(({ row, seed }) => ({
          skuId: row.id,
          qtyCases: randInt(1, 12),
          unitPricePaise: unitPriceOf({ row, seed }),
          piecesPerCase: row.piecesPerCase,
          gstRateBp: row.gstRateBp,
          stockCases: 100_000, // historical: stock not enforced
          scheme: seed.scheme ?? null,
        })),
      );
      // Only a few recent orders are still waiting for the desk; the rest are billed.
      // Open orders count towards credit used, so this keeps the demo balances sensible.
      const status = isOpen ? "PLACED" : "EXPORTED";

      // About a quarter of orders arrive as a pasted message, the way shops write to the office today.
      const viaAi = rand() < 0.28;
      const wrote = (id: string, qtyCases: number) => {
        const sku = picks.find((p) => p.row.id === id)!.seed;
        return `${qtyCases} peti ${sku.name.split(",")[0].toLowerCase()}`;
      };
      await db.order.create({
        data: {
          number: `RD-${String(orderNo++).padStart(6, "0")}`,
          retailerId: retailer.id, status, source: viaAi ? "AI_TEXT" : "CATALOGUE",
          rawMessage: viaAi ? "bhaiya " + priced.lines.map((l) => wrote(l.skuId, l.qtyCases)).join(", ") : null,
          subtotalPaise: priced.subtotalPaise, discountPaise: priced.discountPaise,
          gstPaise: priced.gstPaise, totalPaise: priced.totalPaise,
          createdAt,
          confirmedAt: status === "PLACED" ? null : createdAt,
          exportedAt: status === "EXPORTED" ? createdAt : null,
          lines: {
            create: priced.lines.map((l) => ({
              skuId: l.skuId, qtyCases: l.qtyCases, freeCases: l.freeCases,
              unitPricePaise: unitPriceOf(picks.find((p) => p.row.id === l.skuId)!),
              grossPaise: l.grossPaise, discountPaise: l.discountPaise, gstPaise: l.gstPaise,
              schemeLabel: l.schemeLabel,
              originalText: viaAi ? wrote(l.skuId, l.qtyCases) : null,
              confidence: viaAi ? 0.9 : null,
            })),
          },
        },
      });
    }
  }

  // One order waiting on a credit hold (Yadav Kirana is close to their limit)
  const yadav = await db.retailer.findUniqueOrThrow({ where: { phone: "+919000000002" } });
  const det = byCode.get("SKU-DT-1KG")!.row;
  const held = priceOrder([{
    skuId: det.id, qtyCases: 6, unitPricePaise: det.pricePaise, piecesPerCase: det.piecesPerCase,
    gstRateBp: det.gstRateBp, stockCases: det.stockCases, scheme: byCode.get("SKU-DT-1KG")!.seed.scheme!,
  }]);
  await db.order.create({
    data: {
      number: `RD-${String(orderNo++).padStart(6, "0")}`,
      retailerId: yadav.id, status: "ON_HOLD", source: "CATALOGUE",
      holdReason: "Exceeds credit limit",
      subtotalPaise: held.subtotalPaise, discountPaise: held.discountPaise,
      gstPaise: held.gstPaise, totalPaise: held.totalPaise,
      lines: { create: held.lines.map((l) => ({
        skuId: l.skuId, qtyCases: l.qtyCases, freeCases: l.freeCases, unitPricePaise: det.pricePaise,
        grossPaise: l.grossPaise, discountPaise: l.discountPaise, gstPaise: l.gstPaise, schemeLabel: l.schemeLabel,
      })) },
    },
  });

  // One learned alias, so the AI flow shows the retailer-specific shortcut
  const gupta = await db.retailer.findUniqueOrThrow({ where: { phone: "+919000000001" } });
  await db.alias.create({
    data: {
      retailerId: gupta.id,
      // same key the matcher builds for "chhota biscuit" / "biscuit chhota"
      phrase: aliasKey({ item: "biscuit", size: null, sizeWord: "small" }),
      skuId: byCode.get("SKU-BS-075")!.row.id,
    },
  });

  console.log(`Seeded ${SKUS.length} SKUs, ${RETAILERS.length} retailers, ${orderNo - 1} orders.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

