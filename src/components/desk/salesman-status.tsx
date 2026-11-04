"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Switch a salesman off (they left) or back on. Switching off needs a second tap, because it frees their shops. */
export function SalesmanStatus({ id, name, active, shops }: { id: string; name: string; active: boolean; shops: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function set(next: boolean) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/desk/salesmen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error("failed");
      setConfirming(false);
      router.refresh();
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  if (!active) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">Switched off</span>
        <button type="button" disabled={busy} onClick={() => void set(true)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface">
          Switch on
        </button>
      </div>
    );
  }
  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label={`Switch off ${name}`}>
        <span className="text-xs text-muted">
          {shops > 0 ? `${shops} ${shops === 1 ? "shop goes" : "shops go"} back to unassigned. ` : ""}They are signed out at once.
        </span>
        <button type="button" disabled={busy} onClick={() => void set(false)} className="min-h-11 rounded-xl bg-danger px-3 text-sm font-medium text-white">
          {busy ? "Switching off…" : "Yes, switch off"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface">
          Keep
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span role="alert" className="text-xs text-danger">Failed</span>}
      <button type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium text-muted hover:bg-surface">
        Switch off
      </button>
    </div>
  );
}
