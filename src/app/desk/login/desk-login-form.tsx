"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/password-field";
import { Button, ErrorNote, Field } from "@/components/ui";
import { fmt, type Dict } from "@/lib/i18n/dict";

export function DeskLoginForm({ t }: { t: Dict["desk"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/desk/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok) {
        router.replace(String(data.redirect ?? "/desk"));
        router.refresh();
        return;
      }
      setError(
        data.error === "rate_limited"
          ? fmt(t.errors.rateLimited, { s: Number(data.retryAfterSec ?? 60) })
          : // Only a real 401 means the password was checked and was wrong. A 500 is our fault.
            res.status === 401
            ? t.errors.invalid
            : t.errors.server,
      );
    } catch {
      setError(t.errors.network);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="email" name="email" type="email" label={t.email} autoComplete="username" required />
      <PasswordField
        id="password"
        name="password"
        label={t.password}
        showLabel={t.showPassword}
        hideLabel={t.hidePassword}
        autoComplete="current-password"
        required
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" disabled={busy}>
        {busy ? t.signingIn : t.signIn}
      </Button>
    </form>
  );
}
