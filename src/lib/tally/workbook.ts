import ExcelJS from "exceljs";
import { tallyDate, type TallyOrder } from "./voucher";

const GREEN = "FF1B6B47";
const MONEY = "#,##0.00";

/** Paise to rupees for a cell. Always from a whole number of paise, so sums never drift. */
const rs = (paise: number) => paise / 100;

/** An Indian calendar day as a date cell (Excel dates have no time zone, so use UTC midnight). */
function dayCell(d: Date): Date {
  const s = tallyDate(d); // YYYYMMDD in Indian time
  return new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
}

interface VoucherFigures {
  cases: number;
  free: number;
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  gst: number;
  total: number;
  byRate: Map<number, { taxable: number; cgst: number; sgst: number }>;
}

/**
 * The same numbers the Tally file books, so the register and the import
 * always agree: GST is split half CGST and half SGST per rate, with any odd
 * paisa going to SGST.
 */
export function figuresFor(order: TallyOrder): VoucherFigures {
  const f: VoucherFigures = { cases: 0, free: 0, gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, gst: 0, total: 0, byRate: new Map() };
  const gstByRate = new Map<number, number>();
  for (const l of order.lines) {
    const net = l.grossPaise - l.discountPaise;
    f.cases += l.qtyCases;
    f.free += l.freeCases;
    f.gross += l.grossPaise;
    f.discount += l.discountPaise;
    f.taxable += net;
    gstByRate.set(l.gstRateBp, (gstByRate.get(l.gstRateBp) ?? 0) + l.gstPaise);
    const r = f.byRate.get(l.gstRateBp) ?? { taxable: 0, cgst: 0, sgst: 0 };
    r.taxable += net;
    f.byRate.set(l.gstRateBp, r);
  }
  for (const [rate, gst] of gstByRate) {
    const cgst = Math.floor(gst / 2);
    const sgst = gst - cgst;
    f.cgst += cgst;
    f.sgst += sgst;
    f.gst += gst;
    const r = f.byRate.get(rate)!;
    r.cgst = cgst;
    r.sgst = sgst;
  }
  f.total = f.taxable + f.gst;
  return f;
}

/** "10 x Glucose biscuit 75 g (+1 free)", one line per item, so the register shows what was ordered at a glance. */
export function itemsSummary(order: TallyOrder): string {
  return order.lines
    .map((l) => `${l.qtyCases} x ${l.itemName}${l.freeCases > 0 ? ` (+${l.freeCases} free)` : ""}`)
    .join("\n");
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

function styleTotals(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true };
    cell.border = { top: { style: "thin", color: { argb: "FF999999" } } };
  });
}

/** A SUM over rows 2..last of one column, with the answer stored so any viewer shows a number. */
function sumFormula(col: string, last: number, paise: number) {
  return { formula: `SUM(${col}2:${col}${last})`, result: rs(paise) };
}

export async function buildSalesWorkbook(orders: TallyOrder[], generatedAt: Date = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RetailDesk";
  wb.created = generatedAt;
  wb.title = "Sales register";

  // ---- Vouchers: one row per order
  const vs = wb.addWorksheet("Vouchers");
  vs.columns = [
    { header: "Voucher no", key: "no", width: 14 },
    { header: "Date", key: "date", width: 13, style: { numFmt: "dd-mmm-yyyy" } },
    { header: "Party ledger", key: "party", width: 30 },
    { header: "City", key: "city", width: 22 },
    { header: "Cases", key: "cases", width: 9 },
    { header: "Free cases", key: "free", width: 11 },
    { header: "Gross value", key: "gross", width: 15, style: { numFmt: MONEY } },
    { header: "Scheme discount", key: "disc", width: 16, style: { numFmt: MONEY } },
    { header: "Taxable value", key: "taxable", width: 15, style: { numFmt: MONEY } },
    { header: "CGST", key: "cgst", width: 13, style: { numFmt: MONEY } },
    { header: "SGST", key: "sgst", width: 13, style: { numFmt: MONEY } },
    { header: "Total GST", key: "gst", width: 13, style: { numFmt: MONEY } },
    { header: "Invoice total", key: "total", width: 16, style: { numFmt: MONEY } },
    // What was ordered, readable without opening the second sheet. One item per line.
    { header: "Items ordered", key: "items", width: 54, style: { alignment: { wrapText: true, vertical: "top" } } },
    { header: "Note", key: "note", width: 36 },
  ];

  const sums = { cases: 0, free: 0, gross: 0, disc: 0, taxable: 0, cgst: 0, sgst: 0, gst: 0, total: 0 };
  const rateTotals = new Map<number, { taxable: number; cgst: number; sgst: number }>();

  for (const o of orders) {
    const f = figuresFor(o);
    vs.addRow({
      no: o.number,
      date: dayCell(o.date),
      party: o.partyLedger,
      city: o.city ?? "",
      cases: f.cases,
      free: f.free,
      gross: rs(f.gross),
      disc: rs(f.discount),
      taxable: rs(f.taxable),
      cgst: rs(f.cgst),
      sgst: rs(f.sgst),
      gst: rs(f.gst),
      total: rs(f.total),
      items: itemsSummary(o),
      note: o.note?.trim() ?? "",
    });
    sums.cases += f.cases;
    sums.free += f.free;
    sums.gross += f.gross;
    sums.disc += f.discount;
    sums.taxable += f.taxable;
    sums.cgst += f.cgst;
    sums.sgst += f.sgst;
    sums.gst += f.gst;
    sums.total += f.total;
    for (const [rate, r] of f.byRate) {
      const t = rateTotals.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0 };
      t.taxable += r.taxable;
      t.cgst += r.cgst;
      t.sgst += r.sgst;
      rateTotals.set(rate, t);
    }
  }
  styleHeader(vs);

  const last = vs.rowCount;
  if (orders.length > 0) {
    const t = vs.addRow({ no: "Total" });
    t.getCell("cases").value = { formula: `SUM(E2:E${last})`, result: sums.cases };
    t.getCell("free").value = { formula: `SUM(F2:F${last})`, result: sums.free };
    t.getCell("gross").value = sumFormula("G", last, sums.gross);
    t.getCell("disc").value = sumFormula("H", last, sums.disc);
    t.getCell("taxable").value = sumFormula("I", last, sums.taxable);
    t.getCell("cgst").value = sumFormula("J", last, sums.cgst);
    t.getCell("sgst").value = sumFormula("K", last, sums.sgst);
    t.getCell("gst").value = sumFormula("L", last, sums.gst);
    t.getCell("total").value = sumFormula("M", last, sums.total);
    styleTotals(vs, t.number);
  }

  // ---- Line items: what is on each voucher
  const ls = wb.addWorksheet("Line items");
  ls.columns = [
    { header: "Voucher no", key: "no", width: 14 },
    { header: "Date", key: "date", width: 13, style: { numFmt: "dd-mmm-yyyy" } },
    { header: "Party ledger", key: "party", width: 30 },
    { header: "SKU code", key: "code", width: 14 },
    { header: "Item", key: "item", width: 38 },
    { header: "Cases", key: "cases", width: 9 },
    { header: "Free cases", key: "free", width: 11 },
    { header: "Rate per case", key: "rate", width: 15, style: { numFmt: MONEY } },
    { header: "Gross value", key: "gross", width: 15, style: { numFmt: MONEY } },
    { header: "Scheme discount", key: "disc", width: 16, style: { numFmt: MONEY } },
    { header: "Taxable value", key: "taxable", width: 15, style: { numFmt: MONEY } },
    { header: "GST %", key: "pct", width: 9, style: { numFmt: "0.##" } },
    { header: "GST amount", key: "gst", width: 13, style: { numFmt: MONEY } },
    { header: "Line total", key: "total", width: 15, style: { numFmt: MONEY } },
  ];
  for (const o of orders) {
    for (const l of o.lines) {
      const net = l.grossPaise - l.discountPaise;
      ls.addRow({
        no: o.number,
        date: dayCell(o.date),
        party: o.partyLedger,
        code: l.skuCode ?? "",
        item: l.itemName,
        cases: l.qtyCases,
        free: l.freeCases,
        rate: rs(l.casePricePaise),
        gross: rs(l.grossPaise),
        disc: rs(l.discountPaise),
        taxable: rs(net),
        pct: l.gstRateBp / 100,
        gst: rs(l.gstPaise),
        total: rs(net + l.gstPaise),
      });
    }
  }
  styleHeader(ls);

  // ---- GST summary: what goes on the return, by rate
  const gs = wb.addWorksheet("GST summary");
  gs.columns = [
    { header: "GST rate %", key: "rate", width: 12, style: { numFmt: "0.##" } },
    { header: "Taxable value", key: "taxable", width: 17, style: { numFmt: MONEY } },
    { header: "CGST", key: "cgst", width: 15, style: { numFmt: MONEY } },
    { header: "SGST", key: "sgst", width: 15, style: { numFmt: MONEY } },
    { header: "Total GST", key: "gst", width: 15, style: { numFmt: MONEY } },
  ];
  for (const [rate, t] of [...rateTotals].sort((a, b) => a[0] - b[0])) {
    gs.addRow({ rate: rate / 100, taxable: rs(t.taxable), cgst: rs(t.cgst), sgst: rs(t.sgst), gst: rs(t.cgst + t.sgst) });
  }
  styleHeader(gs);
  if (rateTotals.size > 0) {
    const g = gs.rowCount;
    const t = gs.addRow({ rate: "Total" });
    t.getCell("taxable").value = sumFormula("B", g, sums.taxable);
    t.getCell("cgst").value = sumFormula("C", g, sums.cgst);
    t.getCell("sgst").value = sumFormula("D", g, sums.sgst);
    t.getCell("gst").value = sumFormula("E", g, sums.gst);
    styleTotals(gs, t.number);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
