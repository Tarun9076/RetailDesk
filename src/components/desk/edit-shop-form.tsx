"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";
import { paiseToInput, parseRupeesOrZero } from "@/lib/catalogue-admin/rules";
import { card, hint, input, label, primaryBtn } from "@/components/desk/catalogue/styles";

export interface ShopValues {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string; // as stored, +91XXXXXXXXXX
  city: string;
  creditLimitPaise: number;
  outstandingPaise: number;
  tallyLedgerName: string;
  salesmanId: string;
  active: boolean;
}

const ERRORS: Record<string, string> = {
  invalid_phone: "That is not a valid 10-digit mobile number.",
  phone_taken: "That number already belongs to another shop or a salesman. Each number can be used once.",
  ledger_taken: "Another shop already uses that Tally ledger name. Two shops cannot share one Tally account.",
  unknown_salesman: "That salesman is not available. Pick another.",
};

export function EditShopForm({
  initial,
  salesmen,
  openOrders,
}: {
  initial: ShopValues;
  salesmen: { id: string; name: string }[];
  openOrders: number;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    shopName: initial.shopName,
    ownerName: initial.ownerName,
    phone: initial.phone.replace(/^\+91/, ""),
    city: initial.city,
    credit: paiseToInput(initial.creditLimitPaise),
    owed: paiseToInput(initial.outstandingPaise),
    ledger: initial.tallyLedgerName,
    salesmanId: initial.salesmanId,
    active: initial.active,
  });
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(null);
    setV((p) => ({ ...p, [k]: e.target.value }));
  };

  const switchingOff = initial.active && !v.active;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const credit = parseRupeesOrZero(v.credit);
    const owed = parseRupeesOrZero(v.owed);
    if (credit === null) return setError("Enter the credit limit in rupees, for example 50000.");
    if (owed === null) return setError("Enter the amount owed in rupees, for example 12500.50, or 0.");
    if (switchingOff && !confirmOff) return setConfirmOff(true);

    setBusy(true);
    try {
      const res = await fetch(`/api/desk/shops/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: v.shopName,
          ownerName: v.ownerName,
          phone: v.phone,
          city: v.city,
          creditLimitPaise: credit,
          outstandingPaise: owed,
          tallyLedgerName: v.ledger.trim() || null,
          salesmanId: v.salesmanId || null,
          active: v.active,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; changed?: boolean };
      if (res.ok) {
        setSaved(data.changed ? "Saved." : "Nothing was changed.");
        setConfirmOff(false);
        router.refresh();
      } else {
        setError(ERRORS[data.error ?? ""] ?? "Could not save. Check the details and try again.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className={card} aria-labelledby="shop-details">
      <h2 id="shop-details" className="text-lg font-semibold">Shop details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="shopName" className={label}>Shop name</label>
          <input id="shopName" value={v.shopName} onChange={set("shopName")} required minLength={2} maxLength={100} className={input} />
        </div>
        <div>
          <label htmlFor="ownerName" className={label}>Owner&apos;s name</label>
          <input id="ownerName" value={v.ownerName} onChange={set("ownerName")} required minLength={2} maxLength={80} className={input} />
        </div>
        <div>
          <label htmlFor="phone" className={label}>Owner&apos;s mobile number (they sign in with this)</label>
          <div className="flex min-h-12 items-center rounded-xl border border-line bg-bg focus-within:border-accent">
            <span className="pl-4 pr-2 text-muted">+91</span>
            <input id="phone" type="tel" inputMode="numeric" value={v.phone} onChange={set("phone")} required className="min-h-12 w-full bg-transparent pr-4 text-base outline-none" />
          </div>
          <p className={hint}>Changing it signs the owner out everywhere. They sign in again with the new number.</p>
        </div>
        <div>
          <label htmlFor="city" className={label}>Area</label>
          <input id="city" value={v.city} onChange={set("city")} required minLength={2} maxLength={80} className={input} />
        </div>
        <div>
          <label htmlFor="credit" className={label}>Credit limit (₹)</label>
          <input id="credit" inputMode="decimal" value={v.credit} onChange={set("credit")} required className={input} />
        </div>
        <div>
          <label htmlFor="owed" className={label}>Amount owed (₹)</label>
          <input id="owed" inputMode="decimal" value={v.owed} onChange={set("owed")} required className={input} />
          <p className={hint}>
            Normally filled in by the Tally balance import. Edit it here only to correct one shop.
          </p>
        </div>
        <div>
          <label htmlFor="ledger" className={label}>Name in Tally (optional)</label>
          <input id="ledger" value={v.ledger} onChange={set("ledger")} maxLength={120} placeholder="Same as the shop name" className={input} />
          <p className={hint}>Must match the party name in Tally exactly, or the export and the balance import will not find it.</p>
        </div>
        <div>
          <label htmlFor="salesman" className={label}>Salesman</label>
          <select id="salesman" value={v.salesmanId} onChange={set("salesmanId")} className={input}>
            <option value="">Not assigned</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line p-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-medium">
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => {
              setSaved(null);
              setConfirmOff(false);
              setV((p) => ({ ...p, active: e.target.checked }));
            }}
            className="h-5 w-5 accent-[#1b6b47]"
          />
          Shop is switched on
        </label>
        {!v.active && (
          <p className="mt-2 text-sm text-muted">
            Switched off: the owner is signed out and cannot sign in or order, the shop disappears from its salesman&apos;s
            phone, and it leaves the quiet-shops list. Past orders and the history stay.
            {openOrders > 0 && ` ${openOrders} open ${openOrders === 1 ? "order is" : "orders are"} still in the queue for the desk to finish.`}
          </p>
        )}
      </div>

      {confirmOff && (
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Switch this shop off? Press <strong>Switch off and save</strong> to confirm.
        </p>
      )}
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={switchingOff && confirmOff ? "min-h-12 rounded-xl bg-danger px-6 text-base font-medium text-white" : primaryBtn}>
          {busy ? "Saving…" : switchingOff && confirmOff ? "Switch off and save" : "Save changes"}
        </button>
        {saved && (
          <span role="status" className="text-sm font-medium text-accent">
            {saved}
          </span>
        )}
      </div>
    </form>
  );
}
