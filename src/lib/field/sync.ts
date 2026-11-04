"use client";
import { putOrder, listQueue, saveSnapshot } from "./store";
import type { FieldSnapshot } from "./types";
import type { QueuedOrder } from "./queue";
import type { PlacedLine } from "@/lib/orders/place-types";

export type RefreshResult =
  | { ok: true; snapshot: FieldSnapshot }
  | { ok: false; reason: "offline" | "signed_out" | "error" };

/** Downloads the salesman's shops, prices, stock and credit. The server decides what they may carry. */
export async function downloadSnapshot(): Promise<RefreshResult> {
  let res: Response;
  try {
    res = await fetch("/api/sales/sync", { cache: "no-store" });
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (res.status === 401) return { ok: false, reason: "signed_out" };
  if (!res.ok) return { ok: false, reason: "error" };
  try {
    return { ok: true, snapshot: (await res.json()) as FieldSnapshot };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function storeSnapshot(userId: string, snapshot: FieldSnapshot) {
  await saveSnapshot(userId, snapshot);
}

interface OrderResponse {
  orderId?: string;
  number?: string;
  status?: "PLACED" | "ON_HOLD";
  totalPaise?: number;
  lines?: PlacedLine[];
  error?: string;
  issues?: { skuId: string; issue: { code: string; maxOrderableCases?: number } }[];
}

export type SendOutcome =
  | { kind: "sent"; order: QueuedOrder }
  | { kind: "needs_attention"; order: QueuedOrder }
  | { kind: "stop"; reason: "offline" | "signed_out" | "server"; order: QueuedOrder };

function stockMessage(order: QueuedOrder, res: OrderResponse): string {
  const names = new Map(order.lines.map((l) => [l.skuId, l.name]));
  const parts = (res.issues ?? []).map((i) => {
    const name = names.get(i.skuId) ?? "An item";
    return i.issue.code === "OUT_OF_STOCK"
      ? `${name}: out of stock`
      : `${name}: only ${i.issue.maxOrderableCases ?? 0} cases can be supplied`;
  });
  return parts.length ? parts.join("; ") : "Some items are no longer in stock.";
}

/**
 * Sends one queued order. The order's own id is the idempotency key, so a
 * retry after a dropped connection, or a second tab doing the same, can never
 * create two orders. The server prices it again; whatever it says wins.
 */
export async function sendOne(order: QueuedOrder): Promise<SendOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: order.id,
        retailerId: order.shopId,
        capturedAt: order.createdAt,
        note: order.note || undefined,
        lines: order.lines.map((l) => ({ skuId: l.skuId, qtyCases: l.qtyCases })),
      }),
    });
  } catch {
    return { kind: "stop", reason: "offline", order };
  }
  const data = (await res.json().catch(() => ({}))) as OrderResponse;

  if ((res.status === 201 || res.status === 200) && data.number && data.lines && data.totalPaise !== undefined) {
    const sent: QueuedOrder = {
      ...order,
      status: "sent",
      problem: undefined,
      result: {
        number: data.number,
        orderStatus: data.status ?? "PLACED",
        totalPaise: data.totalPaise,
        lines: data.lines,
        sentAt: new Date().toISOString(),
      },
    };
    return { kind: "sent", order: sent };
  }
  if (res.status === 401) return { kind: "stop", reason: "signed_out", order };
  if (res.status >= 500) return { kind: "stop", reason: "server", order };

  const attention = (kind: NonNullable<QueuedOrder["problem"]>["kind"], message: string): SendOutcome => ({
    kind: "needs_attention",
    order: { ...order, status: "needs_attention", problem: { kind, message } },
  });
  if (res.status === 409) return attention("stock", stockMessage(order, data));
  if (res.status === 403 && data.error === "not_your_shop") {
    return attention("not_your_shop", "This shop is no longer assigned to you. Ask the office.");
  }
  return attention("invalid", "The office could not accept this order. Check it and enter it again.");
}

let flushing: Promise<FlushResult> | null = null;

export interface FlushResult {
  sent: number;
  attention: number;
  remaining: number;
  stoppedBecause: "offline" | "signed_out" | "server" | null;
}

/** Sends everything waiting, oldest first, stopping at the first sign the connection or session is gone. */
export function flushQueue(userId: string, onChange?: () => void): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { sent: 0, attention: 0, remaining: 0, stoppedBecause: null };
    const queue = await listQueue(userId);
    for (const o of queue) {
      // A crash while sending leaves "sending": it is safe to try again, the key makes it idempotent.
      if (o.status !== "pending" && o.status !== "sending") continue;
      const trying: QueuedOrder = { ...o, status: "sending", attempts: o.attempts + 1 };
      await putOrder(trying);
      const out = await sendOne(trying);
      if (out.kind === "stop") {
        await putOrder({ ...trying, status: "pending" });
        result.stoppedBecause = out.reason;
        break;
      }
      await putOrder(out.order);
      if (out.kind === "sent") result.sent++;
      else result.attention++;
      onChange?.();
    }
    result.remaining = (await listQueue(userId)).filter((o) => o.status === "pending" || o.status === "sending").length;
    return result;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
