"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/dict";

export function LanguageToggle({ lang }: { lang: Lang }) {
  const router = useRouter();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  const base = "min-h-11 min-w-11 px-3 text-sm font-medium rounded-full transition-colors";
  return (
    <div role="group" aria-label="Language" className="inline-flex rounded-full border border-line bg-bg p-0.5">
      <button
        type="button"
        onClick={() => choose("en")}
        aria-pressed={lang === "en"}
        className={`${base} ${lang === "en" ? "bg-accent text-white" : "text-muted"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => choose("hi")}
        aria-pressed={lang === "hi"}
        className={`${base} ${lang === "hi" ? "bg-accent text-white" : "text-muted"}`}
      >
        हिं
      </button>
    </div>
  );
}
