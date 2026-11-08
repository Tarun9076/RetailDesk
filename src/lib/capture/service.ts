import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { loadCatalogue } from "@/lib/catalogue";
import { readOrderMessage, readOrderPhoto, type PhotoInput, type ReadResult } from "./gemini";
import { aliasKey, matchLine, shouldLearnAlias } from "./match";
import type { CaptureLineDto, CaptureSource, ConfidenceLevel } from "./types";

const MAX_ALIASES_PER_RETAILER = 300;

export interface StoredCapture {
  source: CaptureSource;
  lines: CaptureLineDto[];
  confirmed?: { index: number; skuId: string; qtyCases: number; original: string; level: ConfidenceLevel }[];
}

/** What the matcher needs to know about one shop: its catalogue, its learned phrases and its history. */
async function loadContext(retailerId: string) {
  const [items, aliasRows, historyRows] = await Promise.all([
    loadCatalogue(retailerId),
    db.alias.findMany({ where: { retailerId } }),
    db.orderLine.groupBy({
      by: ["skuId"],
      where: { order: { retailerId } },
      _count: { _all: true },
    }),
  ]);
  return {
    items,
    catalogue: items.map((i) => ({ code: i.code, name: i.name })),
    matchCtx: {
      items: items.map((i) => ({ id: i.id, code: i.code, name: i.name, stockCases: i.stockCases })),
      aliases: new Map(aliasRows.map((a) => [a.phrase, a.skuId])),
      history: new Map(historyRows.map((h) => [h.skuId, h._count._all])),
    },
  };
}

/** Matches what was read to this shop's products and saves it as a draft for the shopkeeper to check. */
async function saveDraft(
  retailerId: string,
  rawText: string,
  read: ReadResult,
  matchCtx: Awaited<ReturnType<typeof loadContext>>["matchCtx"],
) {
  const lines: CaptureLineDto[] = read.lines.map((l, index) => {
    const m = matchLine(l, matchCtx);
    return {
      index,
      original: l.original,
      item: l.item,
      qty: l.qty,
      unit: l.unit,
      aliasKey: aliasKey(l),
      skuId: m.skuId,
      level: m.level,
      reason: m.reason,
      alternatives: m.alternatives,
    };
  });

  const stored: StoredCapture = { source: read.source, lines };
  const row = await db.aiCapture.create({
    data: { retailerId, rawText, result: stored as unknown as Prisma.InputJsonValue },
  });
  return { captureId: row.id, source: read.source, lines };
}

/**
 * Reads a pasted message for one retailer. Matching uses only that retailer's
 * own habits (their learned phrases and past orders), never another shop's.
 */
export async function createCapture(retailerId: string, text: string) {
  const { catalogue, matchCtx } = await loadContext(retailerId);
  const read = await readOrderMessage(text, catalogue);
  return saveDraft(retailerId, text, read, matchCtx);
}

/**
 * Reads a photo of a list the same way. The picture itself is never stored: only the words read from
 * it are kept, so the desk can see what was understood. Throws if the AI cannot read it.
 */
export async function createPhotoCapture(retailerId: string, image: PhotoInput) {
  const { catalogue, matchCtx } = await loadContext(retailerId);
  const read = await readOrderPhoto(image, catalogue);
  const words = read.lines.map((l) => l.original).join("\n").slice(0, 1500);
  const rawText = words ? `Photo of a list:\n${words}` : "Photo of a list (nothing could be read)";
  return saveDraft(retailerId, rawText, read, matchCtx);
}

export type ConfirmResult =
  | { ok: true; learned: number }
  | { ok: false; reason: "not_found" | "bad_line" };

/**
 * The shopkeeper has reviewed the lines. Remember what they chose, and teach
 * the matcher: when they corrected a guess, or picked on a line it was not
 * sure about, that phrase now points at their choice for this shop only.
 */
export async function confirmCapture(
  retailerId: string,
  captureId: string,
  chosen: { index: number; skuId: string; qtyCases: number }[],
): Promise<ConfirmResult> {
  const capture = await db.aiCapture.findFirst({
    where: { id: captureId, retailerId, status: "DRAFT" },
  });
  if (!capture) return { ok: false, reason: "not_found" };

  const stored = capture.result as unknown as StoredCapture;
  const skuIds = [...new Set(chosen.map((c) => c.skuId))];
  const skus = await db.sku.findMany({ where: { id: { in: skuIds }, active: true }, select: { id: true } });
  const valid = new Set(skus.map((s) => s.id));

  // A product the shop had to swap because it was out of stock is a substitution,
  // not a habit: "250 wala tea" still means the 250 g tea next time it is back.
  const suggestedIds = [...new Set(stored.lines.map((l) => l.skuId).filter((x): x is string => !!x))];
  const stockRows = await db.sku.findMany({ where: { id: { in: suggestedIds } }, select: { id: true, stockCases: true } });
  const outOfStock = new Set(stockRows.filter((s) => s.stockCases === 0).map((s) => s.id));

  const confirmed: NonNullable<StoredCapture["confirmed"]> = [];
  for (const c of chosen) {
    const line = stored.lines.find((l) => l.index === c.index);
    if (!line || !valid.has(c.skuId)) return { ok: false, reason: "bad_line" };
    // The confidence recorded on the order is about the product that was actually
    // ordered: if the shopkeeper changed it, the original certainty no longer applies.
    const level: ConfidenceLevel = line.skuId === c.skuId ? line.level : "medium";
    confirmed.push({ index: c.index, skuId: c.skuId, qtyCases: c.qtyCases, original: line.original, level });
  }

  let learned = 0;
  const existing = await db.alias.count({ where: { retailerId } });
  let room = MAX_ALIASES_PER_RETAILER - existing;
  for (const c of confirmed) {
    const line = stored.lines.find((l) => l.index === c.index)!;
    const learn = shouldLearnAlias({
      aliasKey: line.aliasKey,
      suggestedSkuId: line.skuId,
      suggestedLevel: line.level,
      chosenSkuId: c.skuId,
      suggestedOutOfStock: !!line.skuId && outOfStock.has(line.skuId),
    });
    if (!learn) continue;
    const had = await db.alias.findUnique({
      where: { retailerId_phrase: { retailerId, phrase: line.aliasKey } },
      select: { skuId: true },
    });
    if (!had && room <= 0) continue; // cap the table; updates to existing habits still go through
    await db.alias.upsert({
      where: { retailerId_phrase: { retailerId, phrase: line.aliasKey } },
      create: { retailerId, phrase: line.aliasKey, skuId: c.skuId },
      update: { skuId: c.skuId },
    });
    if (!had) room--;
    learned++;
  }

  await db.aiCapture.update({
    where: { id: capture.id },
    data: { result: { ...stored, confirmed } as unknown as Prisma.InputJsonValue },
  });
  return { ok: true, learned };
}

const LEVEL_CONFIDENCE: Record<ConfidenceLevel, number> = { high: 0.9, medium: 0.6, low: 0.3 };

/** What an order needs to remember about its AI origin. */
export async function captureForOrder(retailerId: string, captureId: string) {
  const capture = await db.aiCapture.findFirst({
    where: { id: captureId, retailerId, status: "DRAFT" },
  });
  if (!capture) return null;
  const stored = capture.result as unknown as StoredCapture;
  const bySku = new Map<string, { originalText: string; confidence: number }>();
  for (const c of stored.confirmed ?? []) {
    if (!bySku.has(c.skuId)) {
      bySku.set(c.skuId, { originalText: c.original, confidence: LEVEL_CONFIDENCE[c.level] });
    }
  }
  return { id: capture.id, rawText: capture.rawText, bySku };
}
