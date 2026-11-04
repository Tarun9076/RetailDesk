const LABEL: Record<string, string> = {
  PLACED: "To check",
  ON_HOLD: "On hold",
  CONFIRMED: "Confirmed",
  EXPORTED: "Exported",
  CANCELLED: "Cancelled",
};

const STYLE: Record<string, string> = {
  PLACED: "bg-accent-soft text-accent",
  ON_HOLD: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-sky-50 text-sky-800",
  EXPORTED: "bg-surface text-muted",
  CANCELLED: "bg-danger-soft text-danger",
};

export function DeskStatus({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[status] ?? STYLE.EXPORTED}`}>
      {LABEL[status] ?? status}
    </span>
  );
}
