"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/password-field";
import { Button, ErrorNote } from "@/components/ui";
import { validateNewPassword } from "@/lib/auth/password-rules";

export function ChangePasswordForm({ minLength, forced }: { minLength: number; forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = validateNewPassword(next, { current });
    if (problem) return setError(problem);
    if (next !== again) return setError("The two new passwords are not the same.");

    setBusy(true);
    try {
      const res = await fetch("/api/desk/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; redirect?: string; retryAfterSec?: number };
      if (res.ok) {
        router.replace(data.redirect ?? "/desk");
        router.refresh();
        return;
      }
      if (data.error === "wrong_current") setError(forced ? "The temporary password is not right." : "Your current password is not right.");
      else if (data.error === "rate_limited") setError(`Too many wrong tries. Try again in ${Math.ceil((data.retryAfterSec ?? 900) / 60)} minutes.`);
      else if (data.error === "weak") setError(data.message ?? "Choose a stronger password.");
      else if (res.status === 401) setError("Your sign-in has ended. Sign in again.");
      else setError("Something went wrong on our side. Please try again in a moment.");
    } catch {
      setError("No connection. Check your internet and try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <PasswordField id="current" label={forced ? "Temporary password" : "Current password"} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" showLabel="Show password" hideLabel="Hide password" />
      <PasswordField id="next" label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" showLabel="Show password" hideLabel="Hide password" />
      <p className="-mt-2 text-xs text-muted">At least {minLength} characters, with letters and numbers (or 16 or more characters).</p>
      <PasswordField id="again" label="New password again" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" showLabel="Show password" hideLabel="Hide password" />
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" disabled={busy || !current || !next || !again}>
        {busy ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
