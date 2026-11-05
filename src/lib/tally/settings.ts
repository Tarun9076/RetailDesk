import { DEFAULT_TALLY_CONFIG, type TallyConfig } from "./voucher";

/** The names the Tally file uses: the defaults, with TALLY_COMPANY (if set) as the company. */
export async function getTallyConfig(): Promise<TallyConfig> {
  const company = process.env.TALLY_COMPANY?.trim();
  return company ? { ...DEFAULT_TALLY_CONFIG, company } : DEFAULT_TALLY_CONFIG;
}
