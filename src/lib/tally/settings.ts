import "server-only";
import { db } from "@/lib/db";
import { mergeTallySettings } from "./masters";
import type { TallyConfig } from "./voucher";

export const SETTING_KEYS = ["company", "salesLedger", "unit", "cgstLedger", "sgstLedger", "voucherType"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function loadStoredSettings(): Promise<Record<string, string>> {
  const rows = await db.tallySetting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** The names the Tally file uses: what the desk saved, else the defaults (and TALLY_COMPANY for the company). */
export async function getTallyConfig(): Promise<TallyConfig> {
  return mergeTallySettings(await loadStoredSettings(), process.env.TALLY_COMPANY);
}
