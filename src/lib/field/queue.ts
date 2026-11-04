// Client-safe and free of browser APIs, so the rules can be unit tested.
import type { PricedOrder } from "@/lib/pricing/types";
import type { PlacedLine } from "@/lib/orders/place-types";

export type QueueStatus = "pending" | "sending" | "sent" | "needs_attention";

export interface QueuedLine {
  skuId: string;
  name: string; // so the order can be read without the catalogue
  nameHi?: string | null; // for the Hindi screens
  qtyCases: number;
}

/** What the phone calculated when the order was taken. */
export interface Expected {
  totalPaise: number;
  lines: PlacedLine[];
}

export type ProblemKind = "stock" | "not_your_shop" | "invalid" | "error";

/** One line the office could not supply. Kept as data, so the screen can say it in either language. */
export interface StockIssue {
  skuId: string;
  code: "OUT_OF_STOCK" | "INSUFFICIENT_STOCK";
  max?: number;
}

export interface QueuedOrder {
  id: string; // also the idempotency key: sending it twice can never make two orders
  userId: string;
  shopId: string;
  shopName: string;
  lines: QueuedLine[];
  note: string;
  createdAt: string; // ISO, from the phone's clock
  expected: Expected;
  status: QueueStatus;
  attempts: number;
  result?: {
    number: string;
    orderStatus: "PLACED" | "ON_HOLD";
    totalPaise: number;
    lines: PlacedLine[];
    sentAt: string;
  };
  /** `message` is an English fallback (and what older saved orders have); screens prefer `issues` and `kind`. */
  problem?: { kind: ProblemKind; message: string; issues?: StockIssue[] };
}

export function newQueuedOrder(input: {
  id: string;
  userId: string;
  shopId: string;
  shopName: string;
  lines: QueuedLine[];
  note: string;
  priced: PricedOrder;
  now?: Date;
}): QueuedOrder {
  return {
    id: input.id,
    userId: input.userId,
    shopId: input.shopId,
    shopName: input.shopName,
    lines: input.lines,
    note: input.note.trim(),
    createdAt: (input.now ?? new Date()).toISOString(),
    expected: {
      totalPaise: input.priced.totalPaise,
      lines: input.priced.lines.map((l) => ({
        skuId: l.skuId,
        qtyCases: l.qtyCases,
        freeCases: l.freeCases,
        totalPaise: l.totalPaise,
      })),
    },
    status: "pending",
    attempts: 0,
  };
}

export interface LineChange {
  skuId: string;
  name: string;
  nameHi?: string | null;
  expectedPaise: number;
  actualPaise: number;
  expectedFree: number;
  actualFree: number;
}

export interface Change {
  changed: boolean;
  totalDeltaPaise: number; // server minus phone; positive = the shop pays more than the phone showed
  lines: LineChange[];
}

/**
 * Compares what the phone showed with what the server charged. The server
 * always decides; this only tells the salesman what moved while they were
 * offline (a price, a scheme, stock).
 */
export function describeChange(order: QueuedOrder): Change {
  const actual = order.result;
  if (!actual) return { changed: false, totalDeltaPaise: 0, lines: [] };
  const lineOf = new Map(order.lines.map((l) => [l.skuId, l]));
  const before = new Map(order.expected.lines.map((l) => [l.skuId, l]));
  const lines: LineChange[] = [];
  for (const a of actual.lines) {
    const e = before.get(a.skuId);
    const expectedPaise = e?.totalPaise ?? 0;
    const expectedFree = e?.freeCases ?? 0;
    if (expectedPaise !== a.totalPaise || expectedFree !== a.freeCases) {
      lines.push({
        skuId: a.skuId,
        name: lineOf.get(a.skuId)?.name ?? a.skuId,
        nameHi: lineOf.get(a.skuId)?.nameHi ?? null,
        expectedPaise,
        actualPaise: a.totalPaise,
        expectedFree,
        actualFree: a.freeCases,
      });
    }
  }
  const totalDeltaPaise = actual.totalPaise - order.expected.totalPaise;
  return { changed: totalDeltaPaise !== 0 || lines.length > 0, totalDeltaPaise, lines };
}

/** A phone left unsynced for this long should warn that its prices may be out of date. */
export const STALE_AFTER_MS = 24 * 3_600_000;

export function isStale(syncedAtIso: string | null, now: Date = new Date()): boolean {
  if (!syncedAtIso) return true;
  return now.getTime() - new Date(syncedAtIso).getTime() > STALE_AFTER_MS;
}

/** Orders still to be sent for a shop: they use up credit the shop does not know about yet. */
export function unsentPaiseFor(queue: QueuedOrder[], shopId: string): number {
  return queue
    .filter((o) => o.shopId === shopId && (o.status === "pending" || o.status === "sending"))
    .reduce((s, o) => s + o.expected.totalPaise, 0);
}

export const isUnsent = (o: QueuedOrder) => o.status === "pending" || o.status === "sending";

/** Sent orders are kept a few days for the "today" list, then dropped. */
export function pruneSent(queue: QueuedOrder[], now: Date = new Date(), keepDays = 3): QueuedOrder[] {
  const cutoff = now.getTime() - keepDays * 86_400_000;
  return queue.filter((o) => o.status !== "sent" || new Date(o.result?.sentAt ?? o.createdAt).getTime() >= cutoff);
}
