"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";

export interface SkuOption {
  id: string;
  name: string;
  stockCases: number;
}

/** Desk correction of one line's product. Re-prices the order and teaches the shop's habit. */
export function ChangeProduct({
  orderId,
  lineId,
  currentSkuId,
  options,
  shop,
  remembers,
}: {
  orderId: string;
  lineId: string;
  currentSkuId: string;
  options: SkuOption[];
  shop: string;
  remembers: boolean; // true when the line came from a message, so the fix will be remembered
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [skuId, setSkuId] = useState(currentSkuId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/desk/orders/${orderId}/lines/${lineId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId }),
      });
      const data = (await res.json().catch(() => ({}))) as { learned?: boolean; error?: string };
      if (res.ok) {
        // The lines are rebuilt on the server, so the confirmation lives on the page, not here.
        router.replace(`/desk/orders/${orderId}?revised=${data.learned ? "learned" : "yes"}`);
        router.refresh();
        return;
      } else {
        setError(
          data.error === "stock"
            ? "Not enough stock of that product for this quantity."
            : data.error === "not_allowed"
              ? "This order can no longer be changed. The page has been refreshed."
              : "That did not work. Please try again.",
        );
        if (data.error === "not_allowed") router.refresh();
      }
    } catch {
      setError("No connection. Please try again.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          <Pencil size={14} aria-hidden /> Change product
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-surface p-3">
      <label htmlFor={`chg-${lineId}`} className="block text-xs font-medium text-muted">
        Correct product
      </label>
      <select
        id={`chg-${lineId}`}
        value={skuId}
        onChange={(e) => setSkuId(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={o.stockCases === 0 && o.id !== currentSkuId}>
            {o.name}
            {o.stockCases === 0 ? " (out of stock)" : ""}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-muted">
        The order is priced again, and the stock and credit check are redone.
        {remembers && ` Next time ${shop} writes the same words, this product is suggested.`}
      </p>
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || skuId === currentSkuId}
          onClick={save}
          className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save change"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium hover:bg-bg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
