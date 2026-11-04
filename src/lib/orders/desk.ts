import "server-only";
import { db } from "@/lib/db";
import { nextStatus, statesAllowing, type DeskAction } from "./transitions";

export type ActionResult =
  | { ok: true; status: string }
  | { ok: false; reason: "not_found" | "not_allowed" };

/**
 * Applies a desk decision. The status check sits inside the UPDATE itself, so
 * two staff members clicking at once cannot both win, and an order that was
 * already exported cannot be changed by a stale page.
 */
export async function applyDeskAction(input: {
  orderId: string;
  action: DeskAction;
  byName: string;
  note?: string;
}): Promise<ActionResult> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { lines: true },
  });
  if (!order) return { ok: false, reason: "not_found" };

  const to = nextStatus(order.status, input.action);
  if (!to) return { ok: false, reason: "not_allowed" };

  return db.$transaction(async (tx): Promise<ActionResult> => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: { in: statesAllowing(input.action) } },
      data: {
        status: to,
        confirmedAt: to === "CONFIRMED" ? new Date() : undefined,
      },
    });
    if (claimed.count !== 1) return { ok: false, reason: "not_allowed" };

    if (to === "CANCELLED") {
      // Put every reserved case (paid and free) back on the shelf.
      for (const l of order.lines) {
        await tx.sku.update({
          where: { id: l.skuId },
          data: { stockCases: { increment: l.qtyCases + l.freeCases } },
        });
      }
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        action: input.action,
        byName: input.byName,
        note: input.note?.trim() || null,
      },
    });
    return { ok: true, status: to };
  });
}
