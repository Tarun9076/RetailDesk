"use client";

import { Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n/dict";
import { useInstall, type Platform } from "./install-provider";

function stepsFor(platform: Platform, t: Dict["install"]): string[] {
  switch (platform) {
    case "ios":
      return t.stepsIos;
    case "android":
      return t.stepsAndroid;
    case "desktop":
      return t.stepsDesktop;
    default:
      return t.stepsOther;
  }
}

/**
 * A button that is always there until the app is installed. Where the browser
 * allows it, one tap opens its own install dialog. Where it does not (iPhone,
 * or Chrome before it is ready), it shows the exact steps for that device.
 */
export function DownloadAppButton({
  t,
  variant = "header",
}: {
  t: Dict["install"];
  variant?: "header" | "block";
}) {
  const { known, installed, canPrompt, platform, prompt } = useInstall();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!known || installed) return null;

  async function onClick() {
    if (canPrompt) {
      const result = await prompt();
      if (result !== "unavailable") return;
    }
    setOpen(true);
  }

  const trigger =
    variant === "block"
      ? "flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-accent px-5 text-base font-medium text-accent hover:bg-accent-soft"
      : "flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-accent hover:bg-accent-soft sm:border sm:border-accent/30 sm:px-4";

  return (
    <>
      {/* aria-label keeps the name when the text is hidden on a narrow phone */}
      <button type="button" onClick={onClick} className={trigger} aria-haspopup="dialog" aria-label={t.download}>
        <Download size={18} aria-hidden />
        <span className={variant === "block" ? "" : "hidden sm:inline"}>{t.download}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-bg p-6 shadow-xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="install-title" className="text-xl font-semibold tracking-tight">
                {t.sheetTitle}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-muted">{t.sheetIntro}</p>
            <ol className="mt-4 space-y-3">
              {stepsFor(platform, t).map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 min-h-12 w-full rounded-xl bg-accent px-5 text-base font-medium text-white hover:bg-accent-strong"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
