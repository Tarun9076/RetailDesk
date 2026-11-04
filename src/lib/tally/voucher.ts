/**
 * Builds a Tally Prime "Import Data" file with one Sales voucher per order.
 *
 * Accounting shape of each voucher (all amounts in rupees, 2 decimals):
 *   Party (shop)         debit   = taxable + GST
 *   Sales                credit  = taxable (after scheme discount)
 *   Output CGST @x%      credit  = half of the GST at that rate
 *   Output SGST @x%      credit  = the other half
 * so every voucher balances to the paisa. Free goods appear as stock lines at
 * zero value, so the godown quantity still reduces in Tally.
 *
 * Ledger and stock item names are the client's to confirm (assumption A10):
 * they are passed in through TallyConfig, not hard-wired.
 */

export interface TallyLine {
  itemName: string;
  qtyCases: number;
  freeCases: number;
  casePricePaise: number;
  grossPaise: number;
  discountPaise: number;
  gstRateBp: number;
  gstPaise: number;
}

export interface TallyOrder {
  number: string;
  date: Date;
  partyLedger: string;
  note?: string | null;
  lines: TallyLine[];
}

export interface TallyConfig {
  company?: string;
  salesLedger: string;
  unit: string; // quantity unit as set up in Tally, e.g. "Case"
}

export const DEFAULT_TALLY_CONFIG: TallyConfig = { salesLedger: "Sales", unit: "Case" };

/** Escapes text for XML and drops characters XML 1.0 does not allow. */
export function xmlEscape(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 75840 -> "758.40", -250 -> "-2.50". Integer maths only. */
export function rupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Tally dates are YYYYMMDD. The business runs on Indian time. */
export function tallyDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts.replaceAll("-", "");
}

function pct(bp: number): string {
  return String(bp / 100).replace(/\.0+$/, "");
}

const tag = (name: string, value: string) => `<${name}>${xmlEscape(value)}</${name}>`;

function stockLine(
  line: TallyLine,
  qty: number,
  amountPaise: number,
  cfg: TallyConfig,
  isFree: boolean,
): string {
  const qtyText = ` ${qty} ${cfg.unit}`;
  return [
    "<ALLINVENTORYENTRIES.LIST>",
    tag("STOCKITEMNAME", line.itemName),
    tag("ISDEEMEDPOSITIVE", "No"),
    tag("RATE", isFree ? `0.00/${cfg.unit}` : `${rupees(line.casePricePaise)}/${cfg.unit}`),
    tag("AMOUNT", rupees(amountPaise)),
    tag("ACTUALQTY", qtyText),
    tag("BILLEDQTY", qtyText),
    "<ACCOUNTINGALLOCATIONS.LIST>",
    tag("LEDGERNAME", cfg.salesLedger),
    tag("ISDEEMEDPOSITIVE", "No"),
    tag("AMOUNT", rupees(amountPaise)),
    "</ACCOUNTINGALLOCATIONS.LIST>",
    "</ALLINVENTORYENTRIES.LIST>",
  ].join("");
}

export function buildVoucher(order: TallyOrder, cfg: TallyConfig): string {
  let taxable = 0;
  const gstByRate = new Map<number, number>();
  const stock: string[] = [];

  for (const l of order.lines) {
    const net = l.grossPaise - l.discountPaise;
    taxable += net;
    gstByRate.set(l.gstRateBp, (gstByRate.get(l.gstRateBp) ?? 0) + l.gstPaise);
    stock.push(stockLine(l, l.qtyCases, net, cfg, false));
    if (l.freeCases > 0) stock.push(stockLine(l, l.freeCases, 0, cfg, true));
  }

  const gstLedgers: string[] = [];
  let gstTotal = 0;
  for (const [rateBp, gst] of [...gstByRate].sort((a, b) => a[0] - b[0])) {
    if (gst === 0) continue;
    // Intra-state sale assumed: the tax splits evenly into CGST and SGST.
    const cgst = Math.floor(gst / 2);
    const sgst = gst - cgst;
    gstTotal += gst;
    for (const [kind, amount] of [["CGST", cgst], ["SGST", sgst]] as const) {
      gstLedgers.push(
        "<LEDGERENTRIES.LIST>",
        tag("LEDGERNAME", `Output ${kind} @${pct(rateBp / 2)}%`),
        tag("ISDEEMEDPOSITIVE", "No"),
        tag("AMOUNT", rupees(amount)),
        "</LEDGERENTRIES.LIST>",
      );
    }
  }

  const discount = order.lines.reduce((s, l) => s + l.discountPaise, 0);
  const narration = [
    `Order ${order.number}`,
    discount > 0 ? `Scheme discount ${rupees(discount)}` : null,
    order.note?.trim() || null,
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">`,
    tag("DATE", tallyDate(order.date)),
    tag("VOUCHERTYPENAME", "Sales"),
    tag("VOUCHERNUMBER", order.number),
    tag("REFERENCE", order.number),
    tag("PARTYLEDGERNAME", order.partyLedger),
    tag("PERSISTEDVIEW", "Invoice Voucher View"),
    tag("ISINVOICE", "Yes"),
    tag("NARRATION", narration),
    // Party is debited: Tally stores that as a negative amount.
    "<LEDGERENTRIES.LIST>",
    tag("LEDGERNAME", order.partyLedger),
    tag("ISDEEMEDPOSITIVE", "Yes"),
    tag("ISPARTYLEDGER", "Yes"),
    tag("AMOUNT", rupees(-(taxable + gstTotal))),
    "</LEDGERENTRIES.LIST>",
    ...stock,
    ...gstLedgers,
    `</VOUCHER></TALLYMESSAGE>`,
  ].join("");
}

export function buildTallyXml(
  orders: TallyOrder[],
  cfg: TallyConfig = DEFAULT_TALLY_CONFIG,
): string {
  const company = cfg.company ? `<SVCURRENTCOMPANY>${xmlEscape(cfg.company)}</SVCURRENTCOMPANY>` : "";
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    "<ENVELOPE>",
    "<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>",
    "<BODY><IMPORTDATA>",
    `<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES>${company}</STATICVARIABLES></REQUESTDESC>`,
    "<REQUESTDATA>",
    ...orders.map((o) => buildVoucher(o, cfg)),
    "</REQUESTDATA>",
    "</IMPORTDATA></BODY>",
    "</ENVELOPE>",
  ].join("\n");
}
