"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";
import { LOW_STOCK_CASES } from "@/lib/catalogue-types";
import { card, hint, input, label, primaryBtn } from "./styles";

type Mode = "add" | "remove" | "set";

const MODES: { key: Mode; title: string; help: string; quick: string[] }[] = [
  { key: "add", title: "Add stock", help: "A delivery or return came in.", quick: ["Delivery from godown", "Customer return"] },
  { key: "remove", title: "Remove stock", help: "Damaged, expired or lost cases.", quick: ["Damaged", "Expired", "Lost or missing"] },
  { key: "set", title: "Set to a count", help: "You counted the shelf. Replaces the number.", quick: ["Stock count"] },
];

export function StockPanel({ skuId, stock }: { skuId: string; stock: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("add");
  const [cases, setCases] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const n = Number(cases);
  const valid = cases !== "" && Number.isInteger(n) && n >= 0 && (mode === "set" || n > 0) && reason.trim().length >= 3;
  const preview = !valid ? null : mode === "add" ? stock + n : mode === "remove" ? stock - n : n;
  const current = MODES.find((m) => m.key === mode)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/desk/products/${skuId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, cases: n, reason, expected: mode === "set" ? stock : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { before?: number; after?: number; error?: string; available?: number; current?: number };
      if (res.ok) {
        setDone(`Stock is now ${data.after} cases (was ${data.before}).`);
        setCases("");
        setReason("");
        router.refresh();
      } else if (data.error === "below_zero") {
        setError(`Only ${data.available} cases are in stock, so you cannot remove ${n}.`);
        router.refresh();
      } else if (data.error === "changed") {
        setError(`Stock changed to ${data.current} cases while you were editing (an order came in). Check the figure and try again.`);
        router.refresh();
      } else {
        setError("Could not change the stock. Please try again.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  const tone = stock === 0 ? "text-danger" : stock <= LOW_STOCK_CASES ? "text-amber-700" : "text-ink";

  return (
    <section className={card} aria-labelledby="stock-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="stock-title" className="text-lg font-semibold">Stock</h2>
        <p className="text-sm text-muted">
          In stock now: <span className={`text-2xl font-semibold ${tone}`}>{stock}</span> cases
          {stock === 0 && <span className="ml-2 font-medium text-danger">Out of stock</span>}
          {stock > 0 && stock <= LOW_STOCK_CASES && <span className="ml-2 font-medium text-amber-700">Low</span>}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">Orders reduce it automatically, and a cancelled order puts it back. Use this for everything else. Every change is recorded with your name and the reason.</p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="What happened">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => {
                setMode(m.key);
                setError(null);
                setDone(null);
              }}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                mode === m.key ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
              }`}
            >
              {m.title}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{current.help}</p>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="cases" className={label}>{mode === "set" ? "Counted cases" : "Cases"}</label>
            <input id="cases" inputMode="numeric" value={cases} onChange={(e) => setCases(e.target.value.replace(/\D/g, ""))} className={input} />
          </div>
          <div>
            <label htmlFor="reason" className={label}>Reason (kept in the history)</label>
            <input id="reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={input} />
            <div className="mt-2 flex flex-wrap gap-2">
              {current.quick.map((q) => (
                <button key={q} type="button" onClick={() => setReason(q)} className="min-h-9 rounded-full bg-surface px-3 text-xs font-medium text-muted hover:bg-line">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
        {preview !== null && (
          <p className={hint}>
            {preview < 0 ? "That is more than the stock on hand." : `Stock will be ${preview} cases.`}
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        {done && (
          <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
            {done}
          </p>
        )}
        <button type="submit" disabled={busy || !valid || (preview !== null && preview < 0)} className={primaryBtn}>
          {busy ? "Saving…" : current.title}
        </button>
      </form>
    </section>
  );
}
