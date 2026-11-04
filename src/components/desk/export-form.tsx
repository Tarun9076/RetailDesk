"use client";

import { CheckCircle2, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ErrorNote } from "@/components/ui";
import { formatPaise } from "@/lib/money";

export interface ExportRow {
  id: string;
  number: string;
  shop: string;
  date: string; // already formatted on the server (Indian time)
  totalPaise: number;
  status: "CONFIRMED" | "EXPORTED";
}

export function ExportForm({ rows }: { rows: ExportRow[] }) {
  const router = useRouter();
  const ready = rows.filter((r) => r.status === "CONFIRMED");
  const done = rows.filter((r) => r.status === "EXPORTED");

  const [selected, setSelected] = useState<Set<string>>(() => new Set(ready.map((r) => r.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const chosen = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const newCount = chosen.filter((r) => r.status === "CONFIRMED").length;
  const againCount = chosen.length - newCount;
  const total = chosen.reduce((s, r) => s + r.totalPaise, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllReady(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of ready) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  async function download() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/desk/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: chosen.map((r) => r.id) }),
      });
      if (!res.ok) {
        setError(
          res.status === 409
            ? "Those orders are no longer ready. The list has been refreshed."
            : "The export did not work. Please try again.",
        );
        if (res.status === 409) router.refresh();
        setBusy(false);
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "tally-sales.xml";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const fresh = Number(res.headers.get("X-Newly-Exported") ?? 0);
      setMessage(
        `${name} downloaded. ${fresh} ${fresh === 1 ? "order" : "orders"} marked as exported.`,
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("No connection. Nothing was exported. Please try again.");
    }
    setBusy(false);
  }

  const row = (r: ExportRow) => (
    <li key={r.id} className="flex items-center gap-3 p-4">
      <input
        type="checkbox"
        id={`row-${r.id}`}
        checked={selected.has(r.id)}
        onChange={() => toggle(r.id)}
        className="h-5 w-5 shrink-0 accent-[var(--accent)]"
      />
      <label htmlFor={`row-${r.id}`} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-medium">{r.number}</span>
          <span className="block truncate text-sm text-muted">
            {r.shop} · {r.date}
          </span>
        </span>
        <span className="shrink-0 font-semibold">{formatPaise(r.totalPaise)}</span>
      </label>
      <Link href={`/desk/orders/${r.id}`} className="shrink-0 px-2 py-3 text-sm text-accent hover:underline">
        View
      </Link>
    </li>
  );

  return (
    <div>
      {message && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" />
          {message}
        </p>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ready for Tally ({ready.length})</h2>
          {ready.length > 0 && (
            <div className="flex gap-1 text-sm">
              <button type="button" onClick={() => setAllReady(true)} className="min-h-11 rounded-lg px-3 text-accent hover:bg-accent-soft">
                Select all
              </button>
              <button type="button" onClick={() => setAllReady(false)} className="min-h-11 rounded-lg px-3 text-muted hover:bg-surface">
                Clear
              </button>
            </div>
          )}
        </div>
        {ready.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line p-6 text-center text-muted">
            No confirmed orders are waiting. Confirm orders in the Orders tab first.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">{ready.map(row)}</ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Recently exported</h2>
          <p className="text-sm text-muted">Tick any to download them again. Nothing changes in the system.</p>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">{done.map(row)}</ul>
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        {error && (
          <div className="mb-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {chosen.length === 0
              ? "Select orders to export."
              : `${newCount} new${againCount > 0 ? ` + ${againCount} again` : ""} · ${formatPaise(total)}`}
          </p>
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={download}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-base font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={18} aria-hidden />
            {busy ? "Preparing file…" : "Download Tally XML"}
          </button>
        </div>
      </div>
    </div>
  );
}
