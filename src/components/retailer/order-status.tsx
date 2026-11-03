import type { Dict } from "@/lib/i18n/dict";

const STYLE: Record<string, string> = {
  PLACED: "bg-accent-soft text-accent",
  ON_HOLD: "bg-amber-50 text-amber-800",
  CONFIRMED: "bg-accent-soft text-accent",
  EXPORTED: "bg-surface text-muted",
  CANCELLED: "bg-danger-soft text-danger",
};

export function OrderStatus({ status, t }: { status: string; t: Dict["orders"]["status"] }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[status] ?? STYLE.EXPORTED}`}>
      {t[status as keyof typeof t] ?? status}
    </span>
  );
}
