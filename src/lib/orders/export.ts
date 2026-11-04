import "server-only";
import { db } from "@/lib/db";
import { buildTallyXml, DEFAULT_TALLY_CONFIG, type TallyOrder } from "@/lib/tally/voucher";
import { buildSalesWorkbook } from "@/lib/tally/workbook";

export type ExportFormat = "xlsx" | "xml";

export type ExportResult =
  | {
      ok: true;
      body: Buffer | string;
      contentType: string;
      extension: ExportFormat;
      count: number;
      newlyExported: number;
    }
  | { ok: false; reason: "nothing_to_export" };

const TYPES: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml; charset=utf-8",
};

/**
 * Exports the chosen orders as an Excel register (default) or a Tally import file.
 *
 * - CONFIRMED orders are marked EXPORTED, and the shop's ledger balance goes up
 *   by the order total (Tally will show the same amount once the data is
 *   entered), so credit used stays correct after the order leaves the queue.
 * - Orders that are already EXPORTED are included again without changing
 *   anything, so the desk can re-download a file that got lost.
 * - Each order is claimed with a conditional update, so exporting the same
 *   order from two screens cannot add its amount to the balance twice.
 * - The database work is committed first and the file is built afterwards, so a
 *   large workbook never keeps a transaction open.
 */
export async function exportOrders(
  orderIds: string[],
  byName: string,
  format: ExportFormat = "xlsx",
): Promise<ExportResult> {
  const prepared = await db.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { id: { in: orderIds }, status: { in: ["CONFIRMED", "EXPORTED"] } },
      include: { retailer: true, lines: { include: { sku: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (orders.length === 0) return null;

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
        data: { orderId: o.id, action: "EXPORT", byName, note: `Exported (${format === "xlsx" ? "Excel" : "Tally XML"})` },
      });
    }

    const vouchers: TallyOrder[] = orders.map((o) => ({
      number: o.number,
      date: o.createdAt,
      partyLedger: o.retailer.tallyLedgerName ?? o.retailer.shopName,
      city: o.retailer.city,
      note: o.note,
      lines: o.lines.map((l) => ({
        skuCode: l.sku.code,
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
    return { vouchers, newlyExported };
  });

  if (!prepared) return { ok: false, reason: "nothing_to_export" };

  const body =
    format === "xlsx"
      ? await buildSalesWorkbook(prepared.vouchers)
      : buildTallyXml(prepared.vouchers, { ...DEFAULT_TALLY_CONFIG, company: process.env.TALLY_COMPANY || undefined });

  return {
    ok: true,
    body,
    contentType: TYPES[format],
    extension: format,
    count: prepared.vouchers.length,
    newlyExported: prepared.newlyExported,
  };
}
