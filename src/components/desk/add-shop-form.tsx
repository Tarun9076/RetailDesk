"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";

const MESSAGES: Record<string, string> = {
  invalid_phone: "That is not a valid 10-digit mobile number.",
  phone_taken: "That number already belongs to a shop or a salesman. Each number can be used once.",
  unknown_salesman: "That salesman is not available. Pick another.",
};

export function AddShopForm({ salesmen }: { salesmen: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    city: "",
    credit: "",
    outstanding: "0",
    salesmanId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/desk/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: f.shopName,
          ownerName: f.ownerName,
          phone: f.phone,
          city: f.city,
          creditLimitRupees: Math.round(Number(f.credit)),
          outstandingRupees: Math.round(Number(f.outstanding || 0)),
          salesmanId: f.salesmanId || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        router.push("/desk/shops?show=all&added=1");
        router.refresh();
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? "Could not add the shop. Check the details and try again.");
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  const input = "min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-base focus:border-accent";
  const label = "mb-1 block text-sm font-medium text-muted";
  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="shopName" className={label}>Shop name</label>
          <input id="shopName" value={f.shopName} onChange={set("shopName")} required minLength={2} maxLength={100} className={input} />
        </div>
        <div>
          <label htmlFor="ownerName" className={label}>Owner&apos;s name</label>
          <input id="ownerName" value={f.ownerName} onChange={set("ownerName")} required minLength={2} maxLength={80} className={input} />
        </div>
        <div>
          <label htmlFor="phone" className={label}>Owner&apos;s mobile number (they sign in with this)</label>
          <div className="flex min-h-12 items-center rounded-xl border border-line bg-bg focus-within:border-accent">
            <span className="pl-4 pr-2 text-muted">+91</span>
            <input id="phone" type="tel" inputMode="numeric" value={f.phone} onChange={set("phone")} required placeholder="98765 43210" className="min-h-12 w-full bg-transparent pr-4 text-base outline-none" />
          </div>
        </div>
        <div>
          <label htmlFor="city" className={label}>Area</label>
          <input id="city" value={f.city} onChange={set("city")} required placeholder="Jabalpur - Sadar" maxLength={80} className={input} />
        </div>
        <div>
          <label htmlFor="credit" className={label}>Credit limit (₹)</label>
          <input id="credit" type="number" inputMode="numeric" min={0} step={1} value={f.credit} onChange={set("credit")} required className={input} />
        </div>
        <div>
          <label htmlFor="outstanding" className={label}>Amount already owed (₹)</label>
          <input id="outstanding" type="number" inputMode="numeric" min={0} step={1} value={f.outstanding} onChange={set("outstanding")} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="salesman" className={label}>Salesman who visits this shop (optional)</label>
        <select id="salesman" value={f.salesmanId} onChange={set("salesmanId")} className={input}>
          <option value="">Not assigned yet</option>
          {salesmen.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <button type="submit" disabled={busy} className="min-h-14 rounded-xl bg-accent px-8 text-base font-medium text-white hover:bg-accent-strong disabled:bg-accent/50">
        {busy ? "Adding…" : "Add shop"}
      </button>
    </form>
  );
}
