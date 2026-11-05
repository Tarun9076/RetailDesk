"use client";

import { Copy, KeyRound, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";
import { card, hint, input, label, primaryBtn, secondaryBtn } from "@/components/desk/catalogue/styles";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  mustChange: boolean;
  isMe: boolean;
  lastEvent: string | null;
}

interface TempShown {
  email: string;
  password: string;
  why: string;
}

const ERRORS: Record<string, string> = {
  email_taken: "That email already has an account.",
  self: "You cannot switch yourself off.",
  last_active: "This is the last active account. Add another colleague before switching it off.",
};

/** The temporary password appears once. After it is closed it cannot be seen again, only replaced. */
function TempPasswordCard({ temp, onClose }: { temp: TempShown; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="rounded-2xl border-2 border-accent bg-accent-soft p-5">
      <p className="flex items-center gap-2 font-semibold text-accent-strong">
        <KeyRound size={18} aria-hidden /> {temp.why}
      </p>
      <p className="mt-2 text-sm">
        Give this to <strong>{temp.email}</strong>. It is shown <strong>only now</strong>. It lets them sign in once, and they
        must then choose their own password.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="rounded-xl bg-bg px-4 py-3 text-lg font-semibold tracking-wider" data-testid="temp-password">
          {temp.password}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(temp.password);
              setCopied(true);
            } catch {
              /* the password is on screen to copy by hand */
            }
          }}
          className={secondaryBtn}
        >
          <span className="flex items-center gap-2"><Copy size={16} aria-hidden /> {copied ? "Copied" : "Copy"}</span>
        </button>
        <button type="button" onClick={onClose} className={secondaryBtn}>I have passed it on</button>
      </div>
    </div>
  );
}

export function StaffManager({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<TempShown | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; what: "reset" | "off" } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("add");
    try {
      const res = await fetch("/api/desk/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = (await res.json().catch(() => ({}))) as { email?: string; tempPassword?: string; error?: string };
      if (res.ok && data.tempPassword) {
        setTemp({ email: data.email ?? email, password: data.tempPassword, why: "Account created" });
        setName("");
        setEmail("");
        router.refresh();
      } else {
        setError(ERRORS[data.error ?? ""] ?? "Could not add the account. Check the name and email.");
      }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(null);
  }

  async function reset(id: string) {
    setError(null);
    setBusy(`reset-${id}`);
    try {
      const res = await fetch(`/api/desk/staff/${id}/reset`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { email?: string; tempPassword?: string };
      if (!res.ok || !data.tempPassword) throw new Error("failed");
      setTemp({ email: data.email ?? "", password: data.tempPassword, why: "New temporary password" });
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Could not reset the password. Try again.");
    }
    setBusy(null);
  }

  async function setActive(id: string, active: boolean) {
    setError(null);
    setBusy(`act-${id}`);
    try {
      const res = await fetch(`/api/desk/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      setConfirming(null);
      router.refresh();
    } catch (e) {
      setError(ERRORS[(e as Error).message] ?? "That did not work. Try again.");
      setConfirming(null);
    }
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      {temp && <TempPasswordCard temp={temp} onClose={() => setTemp(null)} />}

      <form onSubmit={add} className={card} aria-labelledby="add-staff">
        <h2 id="add-staff" className="flex items-center gap-2 text-lg font-semibold">
          <UserPlus size={18} aria-hidden /> Add a colleague
        </h2>
        <p className="mt-1 text-sm text-muted">
          They get a temporary password to pass on. At first sign-in they choose their own.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="st-name" className={label}>Full name</label>
            <input id="st-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} className={input} />
          </div>
          <div>
            <label htmlFor="st-email" className={label}>Email (their sign-in)</label>
            <input id="st-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={120} className={input} />
          </div>
          <button type="submit" disabled={busy !== null} className={primaryBtn}>
            {busy === "add" ? "Adding…" : "Add account"}
          </button>
        </div>
        <p className={hint}>Everything below is recorded with your name.</p>
      </form>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section aria-labelledby="staff-list" className="rounded-2xl border border-line">
        <h2 id="staff-list" className="sr-only">Desk accounts</h2>
        <ul className="divide-y divide-line">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {s.name}
                  {s.isMe && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">You</span>}
                  {!s.active && <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">Switched off</span>}
                  {s.active && s.mustChange && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Has not chosen a password yet</span>
                  )}
                </p>
                <p className="text-sm text-muted">{s.email}</p>
                {s.lastEvent && <p className="text-xs text-muted">{s.lastEvent}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {confirming?.id === s.id ? (
                  <>
                    <span className="text-sm text-muted">
                      {confirming.what === "reset" ? "Sign them out and issue a new temporary password?" : "Switch off and sign them out now?"}
                    </span>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => (confirming.what === "reset" ? void reset(s.id) : void setActive(s.id, false))}
                      className="min-h-11 rounded-xl bg-danger px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busy ? "Working…" : "Yes"}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className={secondaryBtn}>No</button>
                  </>
                ) : s.active ? (
                  <>
                    {!s.isMe && (
                      <button type="button" onClick={() => setConfirming({ id: s.id, what: "reset" })} className={secondaryBtn}>
                        Reset password
                      </button>
                    )}
                    {!s.isMe && (
                      <button type="button" onClick={() => setConfirming({ id: s.id, what: "off" })} className={secondaryBtn}>
                        Switch off
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => void setActive(s.id, true)} className={secondaryBtn}>
                    Switch on
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
