"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";

const MESSAGES: Record<string, string> = {
  invalid_phone: "That is not a valid 10-digit mobile number.",
  phone_taken: "That number already belongs to a salesman or a shop. Each number can be used once.",
};

/** Name and mobile number. The salesman can sign in straight away with an SMS code. */
export function AddSalesman() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdded(null);
    setBusy(true);
    try {
      const res = await fetch("/api/desk/salesmen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setAdded(name.trim());
        setName("");
        setPhone("");
        router.refresh();
      } else {
        setError(MESSAGES[data.error ?? ""] ?? "Could not add the salesman. Check the details and try again.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  const input = "min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-base focus:border-accent";
  return (
    <form onSubmit={submit} className="rounded-2xl border border-line p-5" aria-labelledby="add-salesman">
      <h2 id="add-salesman" className="flex items-center gap-2 text-lg font-semibold">
        <UserPlus size={18} aria-hidden /> Add a salesman
      </h2>
      <p className="mt-1 text-sm text-muted">
        They sign in on the app with this mobile number and an SMS code. Assign shops to them below.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="sm-name" className="mb-1 block text-sm font-medium text-muted">
            Full name
          </label>
          <input id="sm-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} className={input} />
        </div>
        <div>
          <label htmlFor="sm-phone" className="mb-1 block text-sm font-medium text-muted">
            Mobile number
          </label>
          <div className="flex min-h-12 items-center rounded-xl border border-line bg-bg focus-within:border-accent">
            <span className="pl-4 pr-2 text-muted">+91</span>
            <input
              id="sm-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="98765 43210"
              className="min-h-12 w-full bg-transparent pr-4 text-base outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-xl bg-accent px-6 text-base font-medium text-white hover:bg-accent-strong disabled:bg-accent/50"
        >
          {busy ? "Adding…" : "Add salesman"}
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {added && (
        <p role="status" className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          {added} can now sign in on the Salesman sign-in page.
        </p>
      )}
    </form>
  );
}
