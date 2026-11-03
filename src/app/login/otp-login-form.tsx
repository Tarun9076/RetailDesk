"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorNote, Field } from "@/components/ui";
import { fmt, type Dict } from "@/lib/i18n/dict";

type Step = "phone" | "code";

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, data };
  } catch {
    return null;
  }
}

export function OtpLoginForm({ t }: { t: Dict["login"] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const digits = phone.replace(/\D/g, "").slice(-10);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (digits.length !== 10) return setError(t.errors.invalidPhone);
    setBusy(true);
    const r = await post("/api/auth/otp/request", { phone: digits });
    setBusy(false);
    if (!r) return setError(t.errors.network);
    if (r.res.ok) {
      setCode("");
      setCooldown(30);
      return setStep("code");
    }
    const wait = Number(r.data.retryAfterSec ?? 30);
    if (r.data.error === "cooldown") {
      // A code was just sent; let the user enter it.
      setCooldown(wait);
      return setStep("code");
    }
    if (r.data.error === "rate_limited") return setError(fmt(t.errors.rateLimited, { s: wait }));
    if (r.data.error === "invalid_phone") return setError(t.errors.invalidPhone);
    setError(t.errors.sendFailed);
  }

  async function verify(value: string) {
    setError(null);
    setBusy(true);
    const r = await post("/api/auth/otp/verify", { phone: digits, code: value });
    if (!r) {
      setBusy(false);
      return setError(t.errors.network);
    }
    if (r.res.ok) {
      router.replace(String(r.data.redirect ?? "/catalogue"));
      router.refresh();
      return;
    }
    setBusy(false);
    setCode("");
    codeRef.current?.focus();
    if (r.data.error === "rate_limited") {
      return setError(fmt(t.errors.rateLimited, { s: Number(r.data.retryAfterSec ?? 60) }));
    }
    setError(t.errors.invalidCode);
  }

  function onCodeChange(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 6);
    setCode(v);
    if (v.length === 6 && !busy) void verify(v);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>

      {step === "phone" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-4" noValidate>
          <p className="text-muted">{t.subtitle}</p>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-muted">
              {t.phoneLabel}
            </label>
            <div className="flex min-h-14 items-center rounded-xl border border-line bg-bg focus-within:border-accent">
              <span className="pl-4 pr-2 text-lg text-muted">+91</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-h-14 w-full bg-transparent pr-4 text-lg outline-none placeholder:text-muted/60"
              />
            </div>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy}>
            {busy ? t.sending : t.sendCode}
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-muted">{fmt(t.sentTo, { phone: `+91 ${digits}` })}</p>
          <Field
            id="code"
            ref={codeRef}
            label={t.codeLabel}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            disabled={busy}
            onChange={(e) => onCodeChange(e.target.value)}
            className="text-center text-2xl tracking-[0.5em]"
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="button" disabled={busy || code.length !== 6} onClick={() => verify(code)}>
            {busy ? t.verifying : t.verify}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || cooldown > 0}
            onClick={() => requestCode()}
          >
            {cooldown > 0 ? fmt(t.resendIn, { s: cooldown }) : t.resend}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
          >
            {t.changeNumber}
          </Button>
        </div>
      )}
    </div>
  );
}
