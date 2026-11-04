import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { priceLine } from "@/lib/pricing/engine";
import { DEFAULT_TALLY_CONFIG, buildVoucher, rupees, type TallyLine, type TallyOrder } from "./voucher";
import { buildSalesWorkbook, figuresFor, itemsSummary } from "./workbook";

const NOW = new Date("2026-11-04T10:00:00Z");

function line(
  itemName: string,
  qty: number,
  unitPaise: number,
  piecesPerCase: number,
  gstRateBp: number,
  scheme: Parameters<typeof priceLine>[0]["scheme"],
  skuCode = "SKU-X",
): TallyLine {
  const p = priceLine(
    { skuId: itemName, qtyCases: qty, unitPricePaise: unitPaise, piecesPerCase, gstRateBp, stockCases: 1000, scheme },
    NOW,
  );
  return {
    skuCode,
    itemName,
    qtyCases: p.qtyCases,
    freeCases: p.freeCases,
    casePricePaise: unitPaise * piecesPerCase,
    grossPaise: p.grossPaise,
    discountPaise: p.discountPaise,
    gstRateBp,
    gstPaise: p.gstPaise,
  };
}

const biscuit = line("Glucose biscuit 75 g", 10, 790, 96, 1200, { type: "FREE_GOODS", buyQty: 10, freeQty: 1, label: "x" }, "SKU-BS-075");
const detergent = line("Detergent powder 1 kg", 5, 10150, 20, 1800, { type: "SLAB_PERCENT", minQty: 5, percentBp: 300, label: "x" }, "SKU-DT-1KG");
const salt = line("Iodised salt 1 kg", 2, 2400, 25, 0, null, "SKU-SA-1KG");

const order = (over: Partial<TallyOrder> = {}): TallyOrder => ({
  number: "RD-000045",
  date: NOW,
  partyLedger: "Gupta General Store",
  city: "Jabalpur - Sadar",
  lines: [biscuit, detergent],
  ...over,
});

async function read(orders: TallyOrder[]) {
  const wb = new ExcelJS.Workbook();
  // ExcelJS still types its input as an older Buffer; the bytes are the same.
  await wb.xlsx.load((await buildSalesWorkbook(orders, NOW)) as unknown as ExcelJS.Buffer);
  return wb;
}
const num = (v: ExcelJS.CellValue) => (typeof v === "object" && v !== null && "result" in v ? Number(v.result) : Number(v));

describe("buildSalesWorkbook", () => {
  it("makes a real xlsx with the three sheets", async () => {
    const buf = await buildSalesWorkbook([order()], NOW);
    expect(buf.subarray(0, 2).toString()).toBe("PK"); // an xlsx file is a zip
    const wb = await read([order()]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Vouchers", "Line items", "GST summary"]);
  });

  it("writes one voucher row per order with the right money, in rupees as numbers", async () => {
    const o = order();
    const f = figuresFor(o);
    const row = (await read([o])).getWorksheet("Vouchers")!.getRow(2);
    expect(row.getCell("A").value).toBe("RD-000045");
    expect(row.getCell("C").value).toBe("Gupta General Store");
    expect(row.getCell("D").value).toBe("Jabalpur - Sadar");
    expect(row.getCell("G").value).toBe(f.gross / 100);
    expect(row.getCell("H").value).toBe(f.discount / 100);
    expect(row.getCell("I").value).toBe(f.taxable / 100);
    expect(row.getCell("M").value).toBe(f.total / 100);
    expect(typeof row.getCell("M").value).toBe("number"); // not text
  });

  it("balances: taxable + GST = invoice total, and CGST + SGST = GST", async () => {
    const f = figuresFor(order({ lines: [biscuit, detergent, salt] }));
    expect(f.taxable + f.gst).toBe(f.total);
    expect(f.cgst + f.sgst).toBe(f.gst);
  });

  it("splits odd paise so none is lost", () => {
    const odd: TallyLine = { ...salt, gstRateBp: 1200, gstPaise: 101 };
    const f = figuresFor(order({ lines: [odd] }));
    expect(f.cgst).toBe(50);
    expect(f.sgst).toBe(51);
  });

  it("agrees with the Tally file for the same order", () => {
    const o = order({ lines: [biscuit, detergent, salt] });
    const f = figuresFor(o);
    expect(buildVoucher(o, DEFAULT_TALLY_CONFIG)).toContain(`<AMOUNT>-${rupees(f.total)}</AMOUNT>`);
  });

  it("line items add up to the voucher totals", async () => {
    const o = order({ lines: [biscuit, detergent, salt] });
    const wb = await read([o]);
    const lines = wb.getWorksheet("Line items")!;
    expect(lines.rowCount).toBe(4); // header + 3
    let cents = 0;
    for (let r = 2; r <= lines.rowCount; r++) cents += Math.round(num(lines.getRow(r).getCell("N").value) * 100);
    expect(cents).toBe(figuresFor(o).total);
    expect(lines.getRow(2).getCell("D").value).toBe("SKU-BS-075");
    expect(lines.getRow(2).getCell("G").value).toBe(1); // the free case
  });

  it("totals row uses live SUM formulas and also stores the answer", async () => {
    const orders = [order(), order({ number: "RD-000046", lines: [salt] })];
    const sheet = (await read(orders)).getWorksheet("Vouchers")!;
    const total = sheet.getRow(4); // header, 2 vouchers, total
    expect(total.getCell("A").value).toBe("Total");
    const cell = total.getCell("M").value as { formula: string; result: number };
    expect(cell.formula).toBe("SUM(M2:M3)");
    const expected = orders.reduce((s, o) => s + figuresFor(o).total, 0) / 100;
    expect(cell.result).toBeCloseTo(expected, 2);
  });

  it("uses the Indian calendar day for dates", async () => {
    // 20:00 UTC on 4 Nov is already 5 Nov in India
    const o = order({ date: new Date("2026-11-04T20:00:00Z") });
    const d = (await read([o])).getWorksheet("Vouchers")!.getRow(2).getCell("B").value as Date;
    expect(d.toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("summarises GST by rate, with no row for a rate that was not sold", async () => {
    const sheet = (await read([order()])).getWorksheet("GST summary")!;
    const rates = [2, 3].map((r) => sheet.getRow(r).getCell("A").value);
    expect(rates).toEqual([12, 18]);
    expect(sheet.rowCount).toBe(4); // header, two rates, total
  });

  it("keeps shop names and notes exactly, including symbols", async () => {
    const o = order({ partyLedger: "Ram & Sons <Kirana>", note: `Deliver "early" & fast` });
    const row = (await read([o])).getWorksheet("Vouchers")!.getRow(2);
    expect(row.getCell("C").value).toBe("Ram & Sons <Kirana>");
    expect(row.getCell("O").value).toBe(`Deliver "early" & fast`);
  });

  it("lists what was ordered on the voucher row itself, one item per line, with free cases", async () => {
    const row = (await read([order()])).getWorksheet("Vouchers")!.getRow(2);
    expect(row.getCell("N").value).toBe("10 x Glucose biscuit 75 g (+1 free)\n5 x Detergent powder 1 kg");
    expect(itemsSummary(order({ lines: [salt] }))).toBe("2 x Iodised salt 1 kg");
  });

  it("does not touch the totals row or the money columns", async () => {
    const total = (await read([order()])).getWorksheet("Vouchers")!.getRow(3);
    expect(total.getCell("A").value).toBe("Total");
    expect(total.getCell("N").value).toBeNull();
  });

  it("still produces a valid file with no orders", async () => {
    const wb = await read([]);
    expect(wb.getWorksheet("Vouchers")!.rowCount).toBe(1); // headers only
  });
});
