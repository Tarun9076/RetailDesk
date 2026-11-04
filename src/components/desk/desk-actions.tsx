"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";

type Action = "CONFIRM" | "RELEASE" | "CANCEL";

export function DeskActions({
  orderId,
  status,
  overByLabel,
}: {
  orderId: string;
  status: "PLACED" | "ON_HOLD" | "CONFIRMED" | "EXPORTED" | "CANCELLED";
  overByLabel: string | null; // e.g. "₹5,617.69", shown when releasing a credit hold
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  async function run(action: Action, note?: string) {
    setError(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/desk/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      if (res.ok) {
        router.refresh();
        setCancelling(false);
        return;
      }
      setError(
        res.status === 409
          ? "Someone already changed this order. The page has been refreshed."
          : "That did not work. Please try again.",
      );
      if (res.status === 409) router.refresh();
    } catch {
      setError("No connection. Please try again.");
    }
    setBusy(null);
  }

  if (status === "EXPORTED" || status === "CANCELLED") return null;

  const primary =
    "min-h-12 rounded-xl px-5 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";
  const secondary =
    "min-h-12 rounded-xl border border-line px-5 text-base font-medium text-ink hover:bg-surface disabled:opacity-50";

  return (
    <section aria-label="Decide" className="rounded-2xl border border-line p-4">
      {status === "ON_HOLD" && (
        <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This order is{overByLabel ? ` ${overByLabel}` : ""} over the shop&apos;s credit limit. Releasing it means
          you accept that risk. Your name is recorded.
        </p>
      )}

      {!cancelling ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {status === "PLACED" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("CONFIRM")}
              className={`${primary} bg-accent hover:bg-accent-strong`}
            >
              {busy === "CONFIRM" ? "Confirming…" : "Confirm order"}
            </button>
          )}
          {status === "ON_HOLD" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("RELEASE")}
              className={`${primary} bg-amber-700 hover:bg-amber-800`}
            >
              {busy === "RELEASE" ? "Releasing…" : "Release hold and confirm"}
            </button>
          )}
          <button type="button" disabled={busy !== null} onClick={() => setCancelling(true)} className={secondary}>
            Cancel order
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="reason" className="block text-sm font-medium text-muted">
            Reason for cancelling (kept in the order history)
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            rows={2}
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base focus:border-accent"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy !== null || reason.trim().length < 3}
              onClick={() => run("CANCEL", reason)}
              className={`${primary} bg-danger hover:opacity-90`}
            >
              {busy === "CANCEL" ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => setCancelling(false)} className={secondary}>
              Keep order
            </button>
          </div>
          <p className="text-xs text-muted">The reserved stock goes back on the shelf.</p>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </section>
  );
}
