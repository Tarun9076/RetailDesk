"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";
import { parsePercentBp, schemeLabelFor, schemeProblem, type SchemeStatus } from "@/lib/catalogue-admin/rules";
import { card, hint, input, label, primaryBtn, secondaryBtn } from "./styles";

export interface SchemeRow {
  id: string;
  label: string;
  status: SchemeStatus;
  from: string; // YYYY-MM-DD or ""
  until: string;
}

const STATUS: Record<SchemeStatus, { text: string; cls: string }> = {
  live: { text: "Live", cls: "bg-accent-soft text-accent" },
  off: { text: "Switched off", cls: "bg-surface text-muted" },
  scheduled: { text: "Starts later", cls: "bg-amber-100 text-amber-900" },
  expired: { text: "Ended", cls: "bg-surface text-muted" },
};

export function SchemePanel({ skuId, schemes }: { skuId: string; schemes: SchemeRow[] }) {
  const router = useRouter();
  const [type, setType] = useState<"FREE_GOODS" | "SLAB_PERCENT">("SLAB_PERCENT");
  const [a, setA] = useState(""); // buy N | min cases
  const [b, setB] = useState(""); // free M | percent
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const na = Number(a);
  const bp = parsePercentBp(b);
  const nb = Number(b);
  const fields =
    type === "FREE_GOODS"
      ? { type, buyQty: Number.isInteger(na) && na > 0 ? na : null, freeQty: Number.isInteger(nb) && nb > 0 ? nb : null }
      : { type, minQty: Number.isInteger(na) && na > 0 ? na : null, percentBp: bp };
  const problem = schemeProblem({ ...fields, validFrom: from || null, validUntil: until || null });
  const preview = problem ? null : schemeLabelFor(fields);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (problem) return setError(problem);
    setBusy("add");
    try {
      const body =
        type === "FREE_GOODS"
          ? { type, buyQty: na, freeQty: nb, validFrom: from || null, validUntil: until || null }
          : { type, minQty: na, percentBp: bp, validFrom: from || null, validUntil: until || null };
      const res = await fetch(`/api/desk/products/${skuId}/schemes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.ok) {
        setA("");
        setB("");
        setFrom("");
        setUntil("");
        router.refresh();
      } else if (data.error === "duplicate") {
        setError("This product already has that exact scheme switched on.");
      } else {
        setError(data.message ?? "Could not add the scheme. Check the numbers.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(null);
  }

  async function call(id: string, init: RequestInit, key: string) {
    setError(null);
    setBusy(key);
    try {
      const res = await fetch(`/api/desk/schemes/${id}`, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) throw new Error("failed");
      setConfirmRemove(null);
      router.refresh();
    } catch {
      setError("That did not work. Please try again.");
    }
    setBusy(null);
  }

  return (
    <section className={card} aria-labelledby="schemes-title">
      <h2 id="schemes-title" className="text-lg font-semibold">Schemes</h2>
      <p className="mt-1 text-sm text-muted">
        A product can have several. For any quantity, <strong>only the scheme that is worth most to the shop applies</strong>:
        schemes never add up. For example, 3% off at 5+ cases and 5% off at 20+ cases gives 5% from 20 cases.
      </p>

      {schemes.length === 0 ? (
        <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted">No schemes on this product.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {schemes.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {s.label}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[s.status].cls}`}>{STATUS[s.status].text}</span>
                </p>
                <p className="text-xs text-muted">
                  {s.from || s.until ? `${s.from ? `From ${s.from}` : "Already running"}${s.until ? `, until ${s.until} (that whole day)` : ", no end date"}` : "No dates: runs until you switch it off"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {confirmRemove === s.id ? (
                  <>
                    <button type="button" disabled={busy !== null} onClick={() => void call(s.id, { method: "DELETE" }, `del-${s.id}`)} className="min-h-11 rounded-xl bg-danger px-4 text-sm font-medium text-white">
                      {busy === `del-${s.id}` ? "Removing…" : "Yes, remove"}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className={secondaryBtn}>Keep</button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void call(s.id, { method: "PATCH", body: JSON.stringify({ active: s.status === "off" }) }, `tog-${s.id}`)}
                      className={secondaryBtn}
                    >
                      {s.status === "off" ? "Switch on" : "Switch off"}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(s.id)} className={secondaryBtn}>Remove</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-6 border-t border-line pt-5">
        <h3 className="font-semibold">Add a scheme</h3>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Scheme type">
          {(
            [
              ["SLAB_PERCENT", "Percentage off"],
              ["FREE_GOODS", "Free cases"],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => {
                setType(k);
                setA("");
                setB("");
                setError(null);
              }}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium ${type === k ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sa" className={label}>{type === "FREE_GOODS" ? "Buy this many cases" : "When the shop orders this many cases or more"}</label>
            <input id="sa" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} className={input} />
          </div>
          <div>
            <label htmlFor="sb" className={label}>{type === "FREE_GOODS" ? "Get this many cases free" : "Percentage off the whole line"}</label>
            <input
              id="sb"
              inputMode="decimal"
              value={b}
              onChange={(e) => setB(type === "FREE_GOODS" ? e.target.value.replace(/\D/g, "") : e.target.value)}
              placeholder={type === "SLAB_PERCENT" ? "3" : undefined}
              className={input}
            />
            <p className={hint}>
              {type === "FREE_GOODS" ? "Repeats: buy 10 get 1 gives 2 free at 20 cases." : "Applies to every case on the line, not only the extra ones."}
            </p>
          </div>
          <div>
            <label htmlFor="sf" className={label}>Starts on (optional)</label>
            <input id="sf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="su" className={label}>Last day (optional)</label>
            <input id="su" type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={input} />
            <p className={hint}>The scheme runs through the whole of this day.</p>
          </div>
        </div>
        {preview && <p className="mt-3 text-sm">Shopkeepers will see: <strong>{preview}</strong></p>}
        {error && (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <button type="submit" disabled={busy !== null || problem !== null} className={`${primaryBtn} mt-4`}>
          {busy === "add" ? "Adding…" : "Add scheme"}
        </button>
      </form>
    </section>
  );
}
