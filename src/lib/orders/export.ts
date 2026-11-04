import "server-only";
import { db } from "@/lib/db";
import { buildTallyXml, DEFAULT_TALLY_CONFIG, type TallyOrder } from "@/lib/tally/voucher";

export type ExportResult =
  | { ok: true; xml: string; count: number; newlyExported: number }
  | { ok: false; reason: "nothing_to_export" };

/**
 * Builds the Tally file for the chosen orders.
 *
 * - CONFIRMED orders are marked EXPORTED, and the shop's ledger balance goes up
 *   by the order total (Tally will show the same amount once the file is
 *   imported), so credit used stays correct after the order leaves the queue.
 * - Orders that are already EXPORTED are included again without changing
 *   anything, so the desk can re-download a file that got lost.
 * - Each order is claimed with a conditional update, so exporting the same
 *   order from two screens cannot add its amount to the balance twice.
 */
export async function exportOrders(orderIds: string[], byName: string): Promise<ExportResult> {
  return db.$transaction(async (tx): Promise<ExportResult> => {
    const orders = await tx.order.findMany({
      where: { id: { in: orderIds }, status: { in: ["CONFIRMED", "EXPORTED"] } },
      include: { retailer: true, lines: { include: { sku: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (orders.length === 0) return { ok: false, reason: "nothing_to_export" };

    let newlyExported = 0;
    for (const o of orders) {
      if (o.status !== "CONFIRMED") continue;
      const claimed = await tx.order.updateMany({
        where: { id: o.id, status: "CONFIRMED" },
        data: { status: "EXPORTED", exportedAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      newlyExported++;
      await tx.retailer.update({
        where: { id: o.retailerId },
        data: { outstandingPaise: { increment: o.totalPaise } },
      });
      await tx.orderEvent.create({
        data: { orderId: o.id, action: "EXPORT", byName, note: "Exported to Tally" },
      });
    }

    const vouchers: TallyOrder[] = orders.map((o) => ({
      number: o.number,
      date: o.createdAt,
      partyLedger: o.retailer.tallyLedgerName ?? o.retailer.shopName,
      note: o.note,
      lines: o.lines.map((l) => ({
        itemName: l.sku.name,
        qtyCases: l.qtyCases,
        freeCases: l.freeCases,
        casePricePaise: l.unitPricePaise * l.sku.piecesPerCase,
        grossPaise: l.grossPaise,
        discountPaise: l.discountPaise,
        gstRateBp: l.sku.gstRateBp,
        gstPaise: l.gstPaise,
      })),
    }));

    const xml = buildTallyXml(vouchers, {
      ...DEFAULT_TALLY_CONFIG,
      company: process.env.TALLY_COMPANY || undefined,
    });
    return { ok: true, xml, count: orders.length, newlyExported };
  });
}
