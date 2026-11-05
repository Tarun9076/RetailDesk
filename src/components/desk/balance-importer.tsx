"use client";

import { FileSpreadsheet, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ErrorNote } from "@/components/ui";
import { card, primaryBtn, secondaryBtn } from "@/components/desk/catalogue/styles";
import type { BalanceRow, BalanceSummary } from "@/lib/balances/match";
import { formatPaise } from "@/lib/money";

interface Preview {
  importId: string;
  summary: BalanceSummary;
  rows: BalanceRow[];
  columns: { name: string; amount: string };
}

const MESSAGES: Record<string, string> = {
  already_done: "This import was already applied or thrown away. Upload the file again.",
  expired: "This preview is over a day old, so the amounts may have moved. Upload the file again.",
  not_found: "This preview no longer exists. Upload the file again.",
};

function Warn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <TriangleAlert size={16} aria-hidden /> {title}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export function BalanceImporter() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"upload" | "apply" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose the file exported from Tally first.");
    setBusy("upload");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/desk/balances", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as Partial<Preview> & { message?: string };
      if (res.ok && data.importId) {
        setPreview(data as Preview);
      } else {
        setPreview(null);
        setError(data.message ?? "That file could not be used.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(null);
  }

  async function apply() {
    if (!preview) return;
    setError(null);
    setBusy("apply");
    try {
      const res = await fetch(`/api/desk/balances/${preview.importId}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { updated?: number; skippedChanged?: number; unchanged?: number; error?: string };
      if (res.ok) {
        setDone(
          `Done. ${data.updated} ${data.updated === 1 ? "shop" : "shops"} updated` +
            (data.skippedChanged ? `, ${data.skippedChanged} skipped because their amount changed since the preview (upload again for those)` : "") +
            ".",
        );
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        setError(MESSAGES[data.error ?? ""] ?? "Could not apply the import. Try again.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(null);
  }

  async function discard() {
    if (!preview) return;
    setBusy("discard");
    await fetch(`/api/desk/balances/${preview.importId}`, { method: "DELETE" }).catch(() => undefined);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    setBusy(null);
  }

  const s = preview?.summary;
  const changed = preview?.rows.filter((r) => r.afterPaise !== r.beforePaise) ?? [];

  return (
    <div className="space-y-5">
      <form onSubmit={upload} className={card} aria-labelledby="upload-title">
        <h2 id="upload-title" className="flex items-center gap-2 text-lg font-semibold">
          <FileSpreadsheet size={18} aria-hidden /> Upload balances from Tally
        </h2>
        <p className="mt-1 text-sm text-muted">
          In Tally, open <strong>Display, then Account Books, then Outstandings (Receivables)</strong> or the
          <strong> Sundry Debtors group summary</strong>, then export it as Excel or CSV. You will see what would change before anything is saved.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.txt"
            aria-label="Balance file from Tally"
            className="min-h-12 max-w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          <button type="submit" disabled={busy !== null} className={primaryBtn}>
            {busy === "upload" ? "Reading…" : "Check the file"}
          </button>
          <a href="/samples/tally-balances-sample.csv" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
            See a sample file
          </a>
        </div>
      </form>

      {error && <ErrorNote>{error}</ErrorNote>}
      {done && (
        <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          {done}
        </p>
      )}

      {preview && s && (
        <section className={card} aria-labelledby="preview-title">
          <h2 id="preview-title" className="text-lg font-semibold">Check before saving</h2>
          <p className="mt-1 text-sm text-muted">
            Read the name from <strong>{preview.columns.name}</strong> and the amount from <strong>{preview.columns.amount}</strong>.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Shops found", String(s.matched)],
              ["Amounts that change", String(s.changed)],
              ["Total owed now", formatPaise(s.totalBeforePaise)],
              ["Total owed after", formatPaise(s.totalAfterPaise)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <p className="text-xs text-muted">{k}</p>
                <p className="mt-1 text-lg font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            {s.increased} going up, {s.decreased} going down, {s.unchanged} the same.
          </p>

          <div className="mt-4 space-y-2">
            {s.unmatched.length > 0 && (
              <Warn title={`${s.unmatched.length} ${s.unmatched.length === 1 ? "name" : "names"} in the file match no shop`}>
                <p>These are skipped. If a shop is here, set its <em>Name in Tally</em> on its Edit page to match exactly.</p>
                <ul className="mt-2 list-disc pl-5">
                  {s.unmatched.slice(0, 30).map((u) => (
                    <li key={u.name}>{u.name} ({formatPaise(u.paise)})</li>
                  ))}
                </ul>
                {s.unmatched.length > 30 && <p className="mt-1">…and {s.unmatched.length - 30} more.</p>}
              </Warn>
            )}
            {s.ambiguous.length > 0 && (
              <Warn title={`${s.ambiguous.length} ${s.ambiguous.length === 1 ? "name fits" : "names fit"} more than one shop`}>
                <p>These are skipped, not guessed. Give each shop its own Name in Tally.</p>
                <ul className="mt-2 list-disc pl-5">
                  {s.ambiguous.map((a) => (
                    <li key={a.name}>{a.name}</li>
                  ))}
                </ul>
              </Warn>
            )}
            {s.advances.length > 0 && (
              <Warn title={`${s.advances.length} ${s.advances.length === 1 ? "shop is" : "shops are"} in credit in Tally`}>
                <p>Tally says you owe these shops money. The app only tracks what shops owe you, so they are set to ₹0.</p>
                <ul className="mt-2 list-disc pl-5">
                  {s.advances.map((a) => (
                    <li key={a.name}>{a.name} ({formatPaise(-a.paise)} in their favour)</li>
                  ))}
                </ul>
              </Warn>
            )}
            {s.notInFile.length > 0 && (
              <Warn title={`${s.notInFile.length} ${s.notInFile.length === 1 ? "shop is" : "shops are"} not in the file`}>
                <p>Their amounts stay as they are.</p>
                <ul className="mt-2 list-disc pl-5">
                  {s.notInFile.slice(0, 30).map((n) => (
                    <li key={n.shopName}>{n.shopName}</li>
                  ))}
                </ul>
                {s.notInFile.length > 30 && <p className="mt-1">…and {s.notInFile.length - 30} more.</p>}
              </Warn>
            )}
            {s.skippedRows.length > 0 && (
              <Warn title={`${s.skippedRows.length} ${s.skippedRows.length === 1 ? "row" : "rows"} in the file could not be read`}>
                <ul className="list-disc pl-5">
                  {s.skippedRows.slice(0, 20).map((r) => (
                    <li key={r.row}>Row {r.row}: {r.why}</li>
                  ))}
                </ul>
              </Warn>
            )}
          </div>

          {changed.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Shop</th>
                    <th className="px-3 py-2 text-right font-medium">Owed now</th>
                    <th className="px-3 py-2 text-right font-medium">After import</th>
                    <th className="px-3 py-2 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {changed.slice(0, 100).map((r) => {
                    const d = r.afterPaise - r.beforePaise;
                    return (
                      <tr key={r.retailerId}>
                        <td className="px-3 py-2">{r.shopName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatPaise(r.beforePaise)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatPaise(r.afterPaise)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${d > 0 ? "text-danger" : "text-accent"}`}>
                          {d > 0 ? "+" : "−"}
                          {formatPaise(Math.abs(d))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {changed.length > 100 && <p className="px-3 py-2 text-xs text-muted">Showing the first 100 of {changed.length} changes. All of them are applied.</p>}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => void apply()} disabled={busy !== null || s.matched === 0} className={primaryBtn}>
              {busy === "apply" ? "Saving…" : `Save ${s.changed} ${s.changed === 1 ? "change" : "changes"}`}
            </button>
            <button type="button" onClick={() => void discard()} disabled={busy !== null} className={secondaryBtn}>
              Throw this away
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
