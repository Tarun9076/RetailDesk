import { describe, expect, it } from "vitest";
import { matchBalances, normaliseName, type ShopForMatch } from "./match";
import { parseAmount, parseBalances, parseCsv } from "./parse";

describe("amounts as Tally writes them", () => {
  it("reads Dr as owed to us and Cr as owed by us", () => {
    expect(parseAmount("1,25,000.50 Dr")).toBe(12_500_050);
    expect(parseAmount("12,500.00 Cr")).toBe(-1_250_000);
    expect(parseAmount("Dr 400")).toBe(40_000);
    expect(parseAmount("750.5 dr.")).toBe(75_050);
  });
  it("reads brackets and minus as negative, and ignores rupee signs and spaces", () => {
    expect(parseAmount("(500)")).toBe(-50_000);
    expect(parseAmount("-500")).toBe(-50_000);
    expect(parseAmount("₹ 1,000")).toBe(100_000);
    expect(parseAmount("Rs. 2,50,000.25")).toBe(25_000_025);
    expect(parseAmount(250.5)).toBe(25_050);
    expect(parseAmount("0")).toBe(0);
  });
  it("never goes through floating point", () => {
    expect(parseAmount("1.15")).toBe(115);
    expect(parseAmount("0.29")).toBe(29);
    expect(parseAmount("4,35,000.35 Dr")).toBe(43_500_035);
  });
  it("refuses what is not an amount instead of guessing", () => {
    for (const bad of ["", "abc", "1,2,3", "12.345", "1e5", "NA", "--5", "1,000,00"]) expect(parseAmount(bad), bad).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("csv reading", () => {
  it("handles quotes, commas inside quotes, doubled quotes and Windows line ends", () => {
    const rows = parseCsv('Ledger,Balance\r\n"Gupta, General Store","12,000.00 Dr"\r\n"Ram ""Kirana""",500 Dr\r\n');
    expect(rows).toEqual([
      ["Ledger", "Balance"],
      ["Gupta, General Store", "12,000.00 Dr"],
      ['Ram "Kirana"', "500 Dr"],
    ]);
  });
  it("ignores a byte-order mark and empty lines", () => {
    expect(parseCsv("﻿a,b\n\n,\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("finding the columns in a Tally export", () => {
  it("skips the company and title lines above the headings", () => {
    const r = parseBalances([
      ["ABC Distributors"],
      ["Ledger Outstandings"],
      ["1-Apr-26 to 5-Nov-26"],
      [],
      ["Particulars", "Closing Balance"],
      ["Gupta General Store", "30,000.00 Dr"],
      ["Yadav Kirana", "74,000.00 Dr"],
      ["Grand Total", "1,04,000.00 Dr"],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ledgers).toEqual([
      { name: "Gupta General Store", paise: 3_000_000 },
      { name: "Yadav Kirana", paise: 7_400_000 },
    ]);
    expect(r.columns).toEqual({ name: "Particulars", amount: "Closing Balance" });
  });

  it("works with separate Debit and Credit columns", () => {
    const r = parseBalances([
      ["Particulars", "Debit", "Credit"],
      ["Shop A", "5,000.00", ""],
      ["Shop B", "", "1,200.00"],
      ["Shop C", "900.00", "400.00"],
    ]);
    expect(r.ok && r.ledgers).toEqual([
      { name: "Shop A", paise: 500_000 },
      { name: "Shop B", paise: -120_000 },
      { name: "Shop C", paise: 50_000 },
    ]);
  });

  it("adds up a ledger that appears on several rows (bill-wise pending amounts)", () => {
    const r = parseBalances([
      ["Date", "Ref No.", "Party's Name", "Pending Amount"],
      ["1-Oct", "B1", "Shop A", "1,000.00"],
      ["9-Oct", "B2", "shop a", "250.50"],
      ["9-Oct", "B3", "Shop B", "75"],
    ]);
    expect(r.ok && r.ledgers).toEqual([
      { name: "Shop A", paise: 125_050 },
      { name: "Shop B", paise: 7_500 },
    ]);
  });

  it("reports rows it could not read, with their row number, and reads the rest", () => {
    const r = parseBalances([
      ["Ledger name", "Balance"],
      ["Shop A", "1,000 Dr"],
      ["Shop B", "unknown"],
      ["", "50"],
      ["Shop D", "300 Cr"],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ledgers.map((l) => l.name)).toEqual(["Shop A", "Shop D"]);
    expect(r.skipped).toEqual([
      { row: 3, why: '"unknown" is not an amount' },
      { row: 4, why: "No ledger name" },
    ]);
  });

  it("says so plainly when there are no recognisable columns or no rows", () => {
    expect(parseBalances([["foo", "bar"], ["1", "2"]])).toMatchObject({ ok: false, reason: "no_header" });
    expect(parseBalances([["Ledger", "Balance"]])).toMatchObject({ ok: false, reason: "no_rows" });
  });
});

describe("matching ledgers to shops", () => {
  const shops: ShopForMatch[] = [
    { id: "1", shopName: "Gupta General Store", tallyLedgerName: null, outstandingPaise: 3_000_000 },
    { id: "2", shopName: "Yadav Kirana", tallyLedgerName: "Yadav Kirana Store (Napier)", outstandingPaise: 7_400_000 },
    { id: "3", shopName: "Jain Super Mart", tallyLedgerName: null, outstandingPaise: 100 },
    { id: "4", shopName: "Aslam Provision Store", tallyLedgerName: null, outstandingPaise: 0 },
  ];

  it("ignores case, spacing and punctuation, and treats & as and", () => {
    expect(normaliseName("  Gupta   General-Store. ")).toBe(normaliseName("gupta general store"));
    expect(normaliseName("Patel Kirana & General")).toBe(normaliseName("Patel Kirana and General"));
  });

  it("matches by the Tally name when a shop has one, and by shop name when it does not", () => {
    const { rows } = matchBalances(
      [
        { name: "GUPTA general store", paise: 3_500_000 },
        { name: "Yadav Kirana Store (Napier)", paise: 7_000_000 },
      ],
      shops,
    );
    expect(rows.map((r) => [r.retailerId, r.beforePaise, r.afterPaise])).toEqual([
      ["1", 3_000_000, 3_500_000],
      ["2", 7_400_000, 7_000_000],
    ]);
  });

  it("does not match a shop that has a Tally name by its plain shop name", () => {
    const { rows, summary } = matchBalances([{ name: "Yadav Kirana", paise: 1 }], shops);
    expect(rows).toEqual([]);
    expect(summary.unmatched).toEqual([{ name: "Yadav Kirana", paise: 1 }]);
  });

  it("reports ledgers nobody matches, shops the file leaves out, and leaves those alone", () => {
    const { summary } = matchBalances([{ name: "Gupta General Store", paise: 3_000_000 }, { name: "Stranger Traders", paise: 5 }], shops);
    expect(summary.unmatched).toEqual([{ name: "Stranger Traders", paise: 5 }]);
    expect(summary.notInFile.map((s) => s.shopName)).toEqual(["Yadav Kirana", "Jain Super Mart", "Aslam Provision Store"]);
    expect(summary.matched).toBe(1);
    expect(summary.changed).toBe(0);
    expect(summary.unchanged).toBe(1);
  });

  it("refuses to guess when a name fits two shops", () => {
    const dup = [...shops, { id: "5", shopName: "Gupta General Store", tallyLedgerName: null, outstandingPaise: 0 }];
    const { rows, summary } = matchBalances([{ name: "Gupta General Store", paise: 100 }], dup);
    expect(rows).toEqual([]);
    expect(summary.ambiguous).toEqual([{ name: "Gupta General Store", shops: ["Gupta General Store", "Gupta General Store"] }]);
  });

  it("sets a credit balance (we owe them) to 0 and says so", () => {
    const { rows, summary } = matchBalances([{ name: "Jain Super Mart", paise: -250_000 }], shops);
    expect(rows[0].afterPaise).toBe(0);
    expect(summary.advances).toEqual([{ name: "Jain Super Mart", paise: -250_000 }]);
  });

  it("counts what would change, and the totals", () => {
    const { summary } = matchBalances(
      [
        { name: "Gupta General Store", paise: 4_000_000 }, // up
        { name: "Yadav Kirana Store (Napier)", paise: 7_400_000 }, // same
        { name: "Jain Super Mart", paise: 0 }, // down from 100
      ],
      shops,
    );
    expect(summary).toMatchObject({ matched: 3, changed: 2, unchanged: 1, increased: 1, decreased: 1 });
    expect(summary.totalBeforePaise).toBe(3_000_000 + 7_400_000 + 100);
    expect(summary.totalAfterPaise).toBe(4_000_000 + 7_400_000);
  });
});
