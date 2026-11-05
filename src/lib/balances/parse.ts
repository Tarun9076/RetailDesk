// Reads the "who owes us how much" list that Tally can export (Outstandings, Group Summary or a
// ledger list) from a spreadsheet or CSV. Pure functions with no dependencies, so every rule can be
// unit tested. The wording of the column headers varies between Tally reports and versions, so
// columns are found by what they are called, not by position.

export type Cell = string | number | null | undefined;

export interface ParsedLedger {
  name: string;
  /** Owed to us is positive (Tally "Dr"); we owe them is negative (Tally "Cr"). Whole paise. */
  paise: number;
}

export interface SkippedRow {
  row: number; // 1-based, as the person sees it in the sheet
  why: string;
}

export type ParseResult =
  | { ok: true; ledgers: ParsedLedger[]; skipped: SkippedRow[]; columns: { name: string; amount: string } }
  | { ok: false; reason: "no_header" | "no_rows" | "too_many_rows"; message: string };

export const MAX_ROWS = 5000;

const text = (c: Cell) => (c === null || c === undefined ? "" : String(c).trim());

/** Splits one CSV text into rows of cells. Handles quotes, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(input: string): string[][] {
  const src = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/**
 * "1,25,000.50 Dr" -> 12500050, "12,500.00 Cr" -> -1250000, "(500)" -> -50000, "-500" -> -50000,
 * "₹ 1,000" -> 100000, 250.5 -> 25050. Returns null when it is not an amount.
 * Integer maths only (no floating point), so ₹1.15 is exactly 115 paise.
 */
export function parseAmount(cell: Cell): number | null {
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return null;
    return Math.round(cell * 100);
  }
  let s = text(cell);
  if (!s) return null;
  let sign = 1;
  const suffix = s.match(/\s*(Dr|Cr)\.?\s*$/i);
  if (suffix) {
    if (suffix[1].toLowerCase() === "cr") sign = -1;
    s = s.slice(0, suffix.index).trim();
  }
  const prefix = s.match(/^\s*(Dr|Cr)\.?\s+/i);
  if (prefix) {
    if (prefix[1].toLowerCase() === "cr") sign = -1;
    s = s.slice(prefix[0].length);
  }
  if (/^\(.*\)$/.test(s)) {
    sign = -sign;
    s = s.slice(1, -1);
  }
  s = s.replace(/[₹\s]/g, "").replace(/^Rs\.?/i, "");
  if (s.startsWith("-")) {
    sign = -sign;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  // Commas only where they are real thousands separators (1,250.50 or 1,25,000).
  if (s.includes(",") && !/^\d{1,3}(,\d{3}|,\d{2})*,\d{3}(\.\d+)?$/.test(s)) return null;
  s = s.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? sign * paise : null;
}

const NAME_HEADERS = [/ledger/i, /party/i, /particulars/i, /customer/i, /account/i, /^name$/i, /name/i];
const AMOUNT_HEADERS = [/closing\s*balance/i, /pending/i, /outstanding/i, /^balance$/i, /balance/i, /closing/i, /^amount$/i];

function find(headers: string[], patterns: RegExp[], not?: RegExp, skip = -1): number {
  for (const p of patterns) {
    const i = headers.findIndex((h, idx) => idx !== skip && p.test(h) && !(not && not.test(h)));
    if (i >= 0) return i;
  }
  return -1;
}

const isTotalRow = (name: string) => /^(grand\s+)?total\b|^opening balance\b|^closing balance\b/i.test(name.trim());

/**
 * Finds the header row (within the first 20 rows, because Tally puts a company name and a title above it),
 * works out which columns hold the ledger name and the amount, and reads every ledger.
 * Debit and Credit columns are supported, as is one balance column with Dr/Cr. A ledger that appears
 * on several rows (bill-wise outstandings) is added up.
 */
export function parseBalances(rows: Cell[][]): ParseResult {
  let headerAt = -1;
  let nameCol = -1;
  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;

  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const headers = rows[r].map(text);
    const n = find(headers, NAME_HEADERS);
    if (n < 0) continue;
    // The name and the amount must be two different columns: a title line such as "Ledger Outstandings" is not a header.
    const debit = headers.findIndex((h, i) => i !== n && (/^(closing\s*)?debit$|^dr$/i.test(h) || /debit/i.test(h)));
    const credit = headers.findIndex((h, i) => i !== n && (/^(closing\s*)?credit$|^cr$/i.test(h) || /credit/i.test(h)));
    const amount = find(headers, AMOUNT_HEADERS, /debit|credit/i, n);
    if (amount >= 0 || (debit >= 0 && credit >= 0)) {
      headerAt = r;
      nameCol = n;
      amountCol = amount;
      debitCol = debit;
      creditCol = credit;
      break;
    }
  }
  if (headerAt < 0) {
    return {
      ok: false,
      reason: "no_header",
      message:
        "Could not find the columns. The sheet needs a column for the ledger or party name and one for the balance (or Debit and Credit columns).",
    };
  }

  const useDebitCredit = amountCol < 0;
  const body = rows.slice(headerAt + 1);
  if (body.length > MAX_ROWS) {
    return { ok: false, reason: "too_many_rows", message: `The sheet has more than ${MAX_ROWS} rows. Split it and import in parts.` };
  }

  const totals = new Map<string, ParsedLedger>();
  const skipped: SkippedRow[] = [];
  body.forEach((cells, i) => {
    const rowNo = headerAt + 2 + i;
    const name = text(cells[nameCol]);
    if (!name) {
      // Bill-wise reports leave the name blank on continuation rows; empty rows are not worth reporting.
      if (cells.some((c) => text(c) !== "")) skipped.push({ row: rowNo, why: "No ledger name" });
      return;
    }
    if (isTotalRow(name)) return;

    let paise: number | null;
    if (useDebitCredit) {
      const d = text(cells[debitCol]) ? parseAmount(cells[debitCol]) : 0;
      const c = text(cells[creditCol]) ? parseAmount(cells[creditCol]) : 0;
      paise = d === null || c === null ? null : Math.abs(d) - Math.abs(c);
    } else {
      paise = parseAmount(cells[amountCol]);
    }
    if (paise === null) {
      skipped.push({ row: rowNo, why: `"${text(cells[useDebitCredit ? debitCol : amountCol])}" is not an amount` });
      return;
    }
    const key = name.toLowerCase();
    const prev = totals.get(key);
    totals.set(key, { name: prev?.name ?? name, paise: (prev?.paise ?? 0) + paise });
  });

  if (totals.size === 0) {
    return { ok: false, reason: "no_rows", message: "The sheet has no ledger rows under the headings." };
  }
  const header = rows[headerAt].map(text);
  return {
    ok: true,
    ledgers: [...totals.values()],
    skipped,
    columns: {
      name: header[nameCol],
      amount: useDebitCredit ? `${header[debitCol]} / ${header[creditCol]}` : header[amountCol],
    },
  };
}
