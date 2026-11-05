// Works out which names must already exist in Tally for the exported vouchers to import cleanly.
// Tally rejects a voucher that mentions a ledger or stock item it does not know, so this list is the
// set-up checklist for whoever looks after the client's books. Pure functions, no database.
import { DEFAULT_CGST_LEDGER, DEFAULT_SGST_LEDGER, DEFAULT_TALLY_CONFIG, DEFAULT_VOUCHER_TYPE, gstLedgerName, type TallyConfig } from "./voucher";

export interface MasterItem {
  group: "Voucher type" | "Sales ledger" | "GST ledger" | "Party ledger" | "Stock item" | "Unit";
  name: string;
  note: string;
}

/**
 * Everything the file will refer to: the voucher type, the sales ledger, the unit, each GST ledger for
 * the rates in use, every shop (party ledger) and every product (stock item).
 */
export function requiredMasters(
  cfg: TallyConfig,
  input: { gstRatesBp: number[]; shops: { shopName: string; tallyLedgerName: string | null }[]; productNames: string[] },
): MasterItem[] {
  const out: MasterItem[] = [];
  out.push({ group: "Voucher type", name: cfg.voucherType ?? DEFAULT_VOUCHER_TYPE, note: "Must exist, with invoice-style entry (item invoice) switched on" });
  out.push({ group: "Sales ledger", name: cfg.salesLedger, note: "Under Sales Accounts, with inventory values affected" });
  out.push({ group: "Unit", name: cfg.unit, note: "Simple unit of measure; every product is ordered in this unit" });
  for (const bp of [...new Set(input.gstRatesBp)].filter((b) => b > 0).sort((a, b) => a - b)) {
    out.push({ group: "GST ledger", name: gstLedgerName(cfg.cgstLedger ?? DEFAULT_CGST_LEDGER, bp), note: `Output CGST, ${bp / 200}% (half of ${bp / 100}%)` });
    out.push({ group: "GST ledger", name: gstLedgerName(cfg.sgstLedger ?? DEFAULT_SGST_LEDGER, bp), note: `Output SGST, ${bp / 200}% (half of ${bp / 100}%)` });
  }
  for (const s of input.shops) {
    out.push({ group: "Party ledger", name: s.tallyLedgerName?.trim() || s.shopName, note: "Under Sundry Debtors" });
  }
  for (const p of input.productNames) out.push({ group: "Stock item", name: p, note: `Unit: ${cfg.unit}` });
  return out;
}

/** The same list as CSV text (quoted, with a header), for handing to an accountant. */
export function mastersToCsv(items: MasterItem[]): string {
  const q = (s: string) => `"${s.replaceAll('"', '""')}"`;
  return ["Type,Name in Tally,Notes", ...items.map((i) => [i.group, i.name, i.note].map(q).join(","))].join("\r\n") + "\r\n";
}

/** Settings as typed by the desk, with blanks falling back to the defaults. */
export function mergeTallySettings(stored: Record<string, string>, envCompany?: string): TallyConfig {
  const pick = (k: string, d: string) => (stored[k]?.trim() ? stored[k].trim() : d);
  const company = stored.company?.trim() || envCompany?.trim() || undefined;
  return {
    company,
    salesLedger: pick("salesLedger", DEFAULT_TALLY_CONFIG.salesLedger),
    unit: pick("unit", DEFAULT_TALLY_CONFIG.unit),
    cgstLedger: pick("cgstLedger", DEFAULT_CGST_LEDGER),
    sgstLedger: pick("sgstLedger", DEFAULT_SGST_LEDGER),
    voucherType: pick("voucherType", DEFAULT_VOUCHER_TYPE),
  };
}

/** A ledger-name template must say where the rate goes, or every rate would share one ledger. */
export function templateProblem(template: string): string | null {
  if (!template.trim()) return null; // blank = use the default
  if (!template.includes("{rate}")) return "Include {rate} where the percentage goes, for example: Output CGST @{rate}%";
  return null;
}
