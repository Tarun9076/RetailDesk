"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";
import { card, hint, input, label, primaryBtn } from "@/components/desk/catalogue/styles";

export interface TallyValues {
  company: string;
  salesLedger: string;
  unit: string;
  cgstLedger: string;
  sgstLedger: string;
  voucherType: string;
}

export interface TallyDefaults {
  salesLedger: string;
  unit: string;
  cgstLedger: string;
  sgstLedger: string;
  voucherType: string;
}

export function TallySettingsForm({ initial, defaults }: { initial: TallyValues; defaults: TallyDefaults }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof TallyValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setV((p) => ({ ...p, [k]: e.target.value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/desk/tally/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(data.message ?? "Could not save. Check the names and try again.");
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className={card} aria-labelledby="tally-names">
      <h2 id="tally-names" className="text-lg font-semibold">Names in your Tally</h2>
      <p className="mt-1 text-sm text-muted">
        The export file uses these names. They must match your Tally exactly, including capitals and spaces. Leave a box empty to use the standard name shown inside it.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="t-company" className={label}>Company name in Tally</label>
          <input id="t-company" value={v.company} onChange={set("company")} maxLength={120} placeholder="As shown on Tally's company list" className={input} />
          <p className={hint}>The vouchers are imported into this company.</p>
        </div>
        <div>
          <label htmlFor="t-vt" className={label}>Voucher type</label>
          <input id="t-vt" value={v.voucherType} onChange={set("voucherType")} maxLength={120} placeholder={defaults.voucherType} className={input} />
        </div>
        <div>
          <label htmlFor="t-sales" className={label}>Sales ledger</label>
          <input id="t-sales" value={v.salesLedger} onChange={set("salesLedger")} maxLength={120} placeholder={defaults.salesLedger} className={input} />
        </div>
        <div>
          <label htmlFor="t-unit" className={label}>Unit for a case</label>
          <input id="t-unit" value={v.unit} onChange={set("unit")} maxLength={120} placeholder={defaults.unit} className={input} />
        </div>
        <div>
          <label htmlFor="t-cgst" className={label}>CGST ledger name</label>
          <input id="t-cgst" value={v.cgstLedger} onChange={set("cgstLedger")} maxLength={120} placeholder={defaults.cgstLedger} className={input} />
          <p className={hint}>{"{rate}"} becomes each half-rate: a 12% product uses 6.</p>
        </div>
        <div>
          <label htmlFor="t-sgst" className={label}>SGST ledger name</label>
          <input id="t-sgst" value={v.sgstLedger} onChange={set("sgstLedger")} maxLength={120} placeholder={defaults.sgstLedger} className={input} />
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : "Save names"}
        </button>
        {saved && <span role="status" className="text-sm font-medium text-accent">Saved. The next export uses these names.</span>}
      </div>
    </form>
  );
}
