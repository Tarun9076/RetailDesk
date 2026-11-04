import { Inbox } from "lucide-react";
import Link from "next/link";
import { DeskStatus } from "@/components/desk/desk-status";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";

const TABS = [
  { key: "attention", label: "Needs attention", statuses: ["ON_HOLD", "PLACED"] as const },
  { key: "ready", label: "Ready for Tally", statuses: ["CONFIRMED"] as const },
  { key: "done", label: "Done", statuses: ["EXPORTED", "CANCELLED"] as const },
];

const EMPTY: Record<string, string> = {
  attention: "Nothing waiting. New orders from shops will appear here.",
  ready: "No confirmed orders are waiting for export.",
  done: "No exported or cancelled orders yet.",
};

export default async function DeskQueue(props: PageProps<"/desk">) {
  await requireDesk();
  const { tab: rawTab } = await props.searchParams;
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];

  const [counts, orders] = await Promise.all([
    db.order.groupBy({ by: ["status"], _count: true }),
    db.order.findMany({
      where: { status: { in: [...tab.statuses] } },
      include: { retailer: { select: { shopName: true, city: true } }, _count: { select: { lines: true } } },
      // Holds first (ON_HOLD is declared after PLACED, so descending puts it on top):
      // they are the ones blocking a shop's order. Then oldest first.
      orderBy: tab.key === "attention" ? [{ status: "desc" }, { createdAt: "asc" }] : { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const countOf = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => {
          const active = t.key === tab.key;
          const n = countOf(t.statuses);
          return (
            <Link
              key={t.key}
              href={t.key === "attention" ? "/desk" : `/desk?tab=${t.key}`}
              role="tab"
              aria-selected={active}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium ${
                active ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-surface"}`}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Inbox size={40} aria-hidden className="text-muted" />
          <p className="mt-4 text-muted">{EMPTY[tab.key]}</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/desk/orders/${o.id}`}
                className="flex flex-col gap-2 p-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.number}</span>
                    <DeskStatus status={o.status} />
                    {o.source === "AI_TEXT" && (
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
                        AI captured
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-sm">
                    {o.retailer.shopName}
                    <span className="text-muted"> · {o.retailer.city}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {formatDateTime(o.createdAt)} · {o._count.lines} {o._count.lines === 1 ? "item" : "items"}
                  </p>
                  {o.status === "ON_HOLD" && o.holdReason && (
                    <p className="mt-1 text-sm font-medium text-amber-800">{o.holdReason}</p>
                  )}
                </div>
                <p className="text-lg font-semibold sm:text-right">{formatPaise(o.totalPaise)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
