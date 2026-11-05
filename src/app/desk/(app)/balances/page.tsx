import { BalanceImporter } from "@/components/desk/balance-importer";
import { requireDesk } from "@/lib/auth/dal";
import type { BalanceSummary } from "@/lib/balances/match";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";

type Applied = { updated: number; skippedChanged: number; unchanged: number };

export default async function BalancesPage() {
  await requireDesk();
  const [imports, withLedger, total] = await Promise.all([
    db.balanceImport.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    db.retailer.count({ where: { active: true, tallyLedgerName: { not: null } } }),
    db.retailer.count({ where: { active: true } }),
  ]);
  const lastApplied = imports.find((i) => i.status === "APPLIED");
  const tokenSet = Boolean(process.env.BALANCES_API_TOKEN);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Balances from Tally</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        The amount each shop owes comes from your accounts in Tally. Upload the latest list here to bring it up to date, so
        credit limits are checked against the real figure. Do this after the day&apos;s vouchers are entered in Tally.
        {lastApplied?.appliedAt ? ` Last updated ${formatDateTime(lastApplied.appliedAt)} by ${lastApplied.byName}.` : " Not updated from Tally yet."}
      </p>

      <div className="mt-6 max-w-4xl">
        <BalanceImporter />
      </div>

      <section aria-labelledby="how" className="mt-6 max-w-4xl rounded-2xl border border-line p-5 text-sm">
        <h2 id="how" className="text-lg font-semibold">How shops are matched</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>
            A shop is found by its <strong>Name in Tally</strong> (set on the shop&apos;s Edit page), or by its shop name if none is set.
            Capitals, spacing and punctuation do not matter. {withLedger} of {total} shops have a Tally name set.
          </li>
          <li>Names that fit no shop, or more than one, are listed and skipped. Nothing is guessed.</li>
          <li>Tally &quot;Dr&quot; means the shop owes you. &quot;Cr&quot; (they are in credit) is stored as ₹0.</li>
          <li>The numbers that exist only in this app, such as orders exported but not yet entered in Tally, are replaced by Tally&apos;s figure.</li>
        </ul>
        <p className="mt-3 text-muted">
          {tokenSet
            ? "Automatic nightly updates are switched on (see the deployment notes for the address and token)."
            : "Automatic nightly updates are switched off. To switch them on, set BALANCES_API_TOKEN (see the deployment notes)."}
        </p>
      </section>

      <section aria-labelledby="hist" className="mt-6 max-w-4xl rounded-2xl border border-line p-5">
        <h2 id="hist" className="text-lg font-semibold">Past imports</h2>
        {imports.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {imports.map((i) => {
              const s = i.summary as unknown as BalanceSummary & { applied?: Applied };
              return (
                <li key={i.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between">
                  <span>
                    <span className="font-medium">{formatDateTime(i.createdAt)}</span>
                    <span className="ml-2 text-muted">
                      {i.source === "API" ? "Automatic" : i.fileName ?? "Upload"} · {i.byName}
                    </span>
                  </span>
                  <span className="text-muted">
                    {i.status === "APPLIED" && s.applied
                      ? `Applied: ${s.applied.updated} updated${s.applied.skippedChanged ? `, ${s.applied.skippedChanged} skipped` : ""}, total owed ${formatPaise(s.totalAfterPaise)}`
                      : i.status === "PREVIEW"
                        ? "Checked only, not saved"
                        : "Thrown away"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
