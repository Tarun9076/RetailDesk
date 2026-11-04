// Request shapes for the catalogue API. Money arrives in paise (the form converts rupees first).
import { z } from "zod";
import { GST_RATES_BP } from "./rules";

const gst = z.number().int().refine((n) => (GST_RATES_BP as readonly number[]).includes(n), "Unknown GST rate");

export const ProductBody = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,23}$/, "Use capital letters, digits and dashes, e.g. SKU-BS-075"),
  name: z.string().trim().min(2).max(120),
  nameHi: z.string().trim().max(120).nullable().optional(),
  brand: z.string().trim().min(2).max(80),
  piecesPerCase: z.number().int().min(1).max(10_000),
  pricePaise: z.number().int().min(1).max(100_000_00), // up to Rs 1,00,000 a piece
  gstRateBp: gst,
  stockCases: z.number().int().min(0).max(1_000_000).default(0),
});

export const ProductPatch = ProductBody.omit({ code: true, stockCases: true }).extend({ active: z.boolean() });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

export const SchemeBody = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FREE_GOODS"),
    buyQty: z.number().int().min(1).max(10_000),
    freeQty: z.number().int().min(1).max(10_000),
    validFrom: date,
    validUntil: date,
  }),
  z.object({
    type: z.literal("SLAB_PERCENT"),
    minQty: z.number().int().min(1).max(10_000),
    percentBp: z.number().int().min(1).max(10_000),
    validFrom: date,
    validUntil: date,
  }),
]);

export const SchemePatch = z.object({
  active: z.boolean().optional(),
  validFrom: date,
  validUntil: date,
});

export const StockBody = z.object({
  mode: z.enum(["add", "remove", "set"]),
  cases: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3).max(200),
  /** Only for "set": the level the desk was looking at. If it moved meanwhile (an order came in), the change is refused. */
  expected: z.number().int().min(0).optional(),
});

export const ShopPriceBody = z.object({ pricePaise: z.number().int().min(1).max(100_000_00) });
