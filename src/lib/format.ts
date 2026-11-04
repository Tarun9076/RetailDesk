import type { Lang } from "@/lib/i18n/dict";

// The business and its customers are in India. Servers often run in UTC, so the
// time zone is always set explicitly or an evening order would show tomorrow's date.
const TZ = "Asia/Kolkata";
const locale = (lang: Lang) => (lang === "hi" ? "hi-IN" : "en-IN");

export function formatDate(d: Date, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(d: Date, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDateTimeLong(d: Date, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
