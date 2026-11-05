import { Download } from "lucide-react";
import Link from "next/link";
import { TallySettingsForm } from "@/components/desk/tally-settings-form";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { requiredMasters } from "@/lib/tally/masters";
import { loadStoredSettings, getTallyConfig } from "@/lib/tally/settings";
import { DEFAULT_CGST_LEDGER, DEFAULT_SGST_LEDGER, DEFAULT_TALLY_CONFIG, DEFAULT_VOUCHER_TYPE } from "@/lib/tally/voucher";

export default async function TallyPage() {
  await requireDesk();
  const [stored, cfg, shops, skus] = await Promise.all([
    loadStoredSettings(),
    getTallyConfig(),
    db.retailer.findMany({ where: { active: true }, select: { id: true, shopName: true, tallyLedgerName: true }, orderBy: { shopName: "asc" } }),
    db.sku.findMany({ where: { active: true }, select: { name: true, gstRateBp: true }, orderBy: { name: "asc" } }),
  ]);
  const masters = requiredMasters(cfg, { gstRatesBp: skus.map((s) => s.gstRateBp), shops, productNames: skus.map((s) => s.name) });
  const groups = ["Voucher type", "Sales ledger", "Unit", "GST ledger", "Party ledger", "Stock item"] as const;
  const noName = shops.filter((s) => !s.tallyLedgerName?.trim());

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Tally set-up</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Tally only accepts a voucher whose ledgers, stock items and unit already exist, spelt exactly the same. Set the names
        here, give the checklist to whoever looks after your Tally, then try one order.
      </p>

      <div className="mt-6 grid max-w-6xl gap-6 xl:grid-cols-2">
        <TallySettingsForm
          initial={{
            company: stored.company ?? cfg.company ?? "",
            salesLedger: stored.salesLedger ?? "",
            unit: stored.unit ?? "",
            cgstLedger: stored.cgstLedger ?? "",
            sgstLedger: stored.sgstLedger ?? "",
            voucherType: stored.voucherType ?? "",
          }}
          defaults={{
            salesLedger: DEFAULT_TALLY_CONFIG.salesLedger,
            unit: DEFAULT_TALLY_CONFIG.unit,
            cgstLedger: DEFAULT_CGST_LEDGER,
            sgstLedger: DEFAULT_SGST_LEDGER,
            voucherType: DEFAULT_VOUCHER_TYPE,
          }}
        />

        <section aria-labelledby="checklist" className="rounded-2xl border border-line p-5">
          <h2 id="checklist" className="text-lg font-semibold">What must exist in Tally</h2>
          <p className="mt-1 text-sm text-muted">With the names above. {masters.length} items in all.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {groups.map((g) => {
              const n = masters.filter((m) => m.group === g).length;
              return n === 0 ? null : (
                <li key={g} className="flex justify-between border-b border-line py-1.5">
                  <span>{g}</span>
                  <span className="text-muted">{n}</span>
                </li>
              );
            })}
          </ul>
          <a
            href="/api/desk/tally/masters"
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            <Download size={16} aria-hidden /> Download the checklist (CSV)
          </a>
          {noName.length > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {noName.length} of {shops.length} shops have no <em>Name in Tally</em>, so their shop name is used. If it is spelt differently in Tally, set it on the shop&apos;s Edit page (<Link href="/desk/shops?show=all" className="underline">Shops</Link>).
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="try" className="mt-6 max-w-6xl rounded-2xl border border-line p-5 text-sm">
        <h2 id="try" className="text-lg font-semibold">Trying it with real Tally</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted">
          <li>Make a <strong>copy of the company</strong> (or use a test company) so nothing real is touched.</li>
          <li>In that company, create the items on the checklist, or ask your Tally partner to.</li>
          <li>Confirm one order on the Orders tab and export it as <strong>Tally XML</strong> on the Export tab.</li>
          <li>In Tally: <strong>Import, then Data, then Vouchers</strong>, choose the file. Look at the voucher: party, items, quantities, CGST and SGST should match the order and total to the paisa.</li>
          <li>If Tally lists an error such as &quot;Ledger not found&quot;, fix that name here (or on the shop&apos;s page) and export again.</li>
        </ol>
        <p className="mt-3 text-muted">
          This file format follows Tally Prime&apos;s voucher import, but it has not yet been imported into a real Tally here. The first
          real trial is the check.
        </p>
      </section>
    </div>
  );
}
