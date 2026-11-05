"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/dict";

export function LanguageToggle({ lang, onChoose }: { lang: Lang; onChoose?: (next: Lang) => void }) {
  const router = useRouter();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // The salesman app switches on the phone itself (it must work with no connection);
    // every other screen asks the server for the page again in the new language.
    if (onChoose) onChoose(next);
    else router.refresh();
  }

  // A quiet two-way switch: the chosen language is a white chip, the other is plain text.
  const base = "min-h-10 min-w-10 rounded-full px-2.5 text-[13px] font-medium transition-colors";
  return (
    <div role="group" aria-label="Language" className="inline-flex items-center rounded-full bg-surface p-0.5">
      <button
        type="button"
        onClick={() => choose("en")}
        aria-pressed={lang === "en"}
        className={`${base} ${lang === "en" ? "bg-bg text-ink shadow-sm" : "text-muted"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => choose("hi")}
        aria-pressed={lang === "hi"}
        lang="hi"
        className={`${base} ${lang === "hi" ? "bg-bg text-ink shadow-sm" : "text-muted"}`}
      >
        हिं
      </button>
    </div>
  );
}
