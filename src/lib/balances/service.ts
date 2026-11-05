import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { matchBalances, type BalanceRow, type BalanceSummary } from "./match";
import { parseBalances, type Cell } from "./parse";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** A preview is only good for a day: after that the shops' amounts may have moved too far to trust it. */
const PREVIEW_LIFETIME_MS = 24 * 3_600_000;

/** First worksheet of an .xlsx as plain cells. Formulas give their saved result; dates and rich text give their text. */
export async function readSpreadsheet(buffer: Buffer): Promise<Cell[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const rows: Cell[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: Cell[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (typeof v === "number") cells.push(v);
      else if (v && typeof v === "object" && "result" in v && typeof v.result === "number") cells.push(v.result);
      else cells.push(cell.text ?? "");
    }
    rows.push(cells);
  });
  return rows;
}

export type PreviewResult =
  | { ok: true; importId: string; summary: BalanceSummary; rows: BalanceRow[]; columns: { name: string; amount: string } }
  | { ok: false; message: string };

/** Reads the cells, matches them to shops, and saves the result as a preview. Nothing in the shops changes yet. */
export async function previewBalances(
  cells: Cell[][],
  meta: { source: "UPLOAD" | "API"; fileName: string | null; byName: string },
): Promise<PreviewResult> {
  const parsed = parseBalances(cells);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const shops = await db.retailer.findMany({
    where: { active: true },
    select: { id: true, shopName: true, tallyLedgerName: true, outstandingPaise: true },
  });
  const { rows, summary } = matchBalances(parsed.ledgers, shops, parsed.skipped);
  if (rows.length === 0 && summary.ambiguous.length === 0) {
    return {
      ok: false,
      message:
        "None of the ledgers in the file matched a shop. Check that the names in Tally match the shops' Tally names (Shops, then Edit, then Name in Tally).",
    };
  }
  const imp = await db.balanceImport.create({
    // Plain data, saved as JSON (the types are interfaces, which Prisma will not take as JSON directly).
    data: {
      source: meta.source,
      fileName: meta.fileName,
      byName: meta.byName,
      status: "PREVIEW",
      rows: JSON.parse(JSON.stringify(rows)),
      summary: JSON.parse(JSON.stringify(summary)),
    },
    select: { id: true },
  });
  return { ok: true, importId: imp.id, summary, rows, columns: parsed.columns };
}

export type ApplyResult =
  | { ok: true; updated: number; skippedChanged: number; unchanged: number }
  | { ok: false; reason: "not_found" | "already_done" | "expired" };

/**
 * Writes a previewed import. A shop is only updated if its amount is still what the preview saw, so an
 * order exported in between, or a hand correction, is never silently overwritten; those shops are reported.
 */
export async function applyBalanceImport(importId: string, byName: string): Promise<ApplyResult> {
  const imp = await db.balanceImport.findUnique({ where: { id: importId } });
  if (!imp) return { ok: false, reason: "not_found" };
  if (imp.status !== "PREVIEW") return { ok: false, reason: "already_done" };
  if (Date.now() - imp.createdAt.getTime() > PREVIEW_LIFETIME_MS) return { ok: false, reason: "expired" };

  const rows = imp.rows as unknown as BalanceRow[];
  return db.$transaction(async (tx): Promise<ApplyResult> => {
    // Claim the import first, so two people pressing Apply cannot both write it.
    const claimed = await tx.balanceImport.updateMany({ where: { id: importId, status: "PREVIEW" }, data: { status: "APPLIED", appliedAt: new Date() } });
    if (claimed.count !== 1) return { ok: false, reason: "already_done" };

    let updated = 0;
    let skippedChanged = 0;
    let unchanged = 0;
    for (const r of rows) {
      if (r.afterPaise === r.beforePaise) {
        unchanged++;
        continue;
      }
      const res = await tx.retailer.updateMany({
        where: { id: r.retailerId, outstandingPaise: r.beforePaise },
        data: { outstandingPaise: r.afterPaise },
      });
      if (res.count !== 1) {
        skippedChanged++;
        continue;
      }
      updated++;
      await tx.shopEvent.create({
        data: {
          retailerId: r.retailerId,
          kind: "BALANCE_IMPORTED",
          byName,
          summary: `Amount owed ${formatPaise(r.beforePaise)} to ${formatPaise(r.afterPaise)} (from Tally${imp.fileName ? `, ${imp.fileName}` : ""})`,
        },
      });
    }
    const summary = { ...(imp.summary as object), applied: { updated, skippedChanged, unchanged } };
    await tx.balanceImport.update({ where: { id: importId }, data: { summary } });
    return { ok: true, updated, skippedChanged, unchanged };
  });
}

export async function discardBalanceImport(importId: string): Promise<boolean> {
  const r = await db.balanceImport.updateMany({ where: { id: importId, status: "PREVIEW" }, data: { status: "DISCARDED" } });
  return r.count === 1;
}
