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

/** One column layout shared by the header row and every order row, so they always line up. */
const ROW_GRID =
  "lg:grid lg:grid-cols-[7rem_minmax(0,1.4fr)_10rem_6rem_minmax(0,1.2fr)_9rem]";

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

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
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
        // Cards on a phone, two columns of cards on a tablet, one table on a laptop or monitor.
        <div className="mt-4 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-line">
          {/* Column names only where there is room for columns. */}
          <div className={`hidden bg-surface px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted lg:gap-4 ${ROW_GRID}`}>
            <span>Order</span>
            <span>Shop</span>
            <span>Placed</span>
            <span>Items</span>
            <span>Status</span>
            <span className="text-right">Total</span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 lg:block lg:divide-y lg:divide-line">
            {orders.map((o) => (
              <li key={o.id} className="overflow-hidden rounded-2xl border border-line lg:rounded-none lg:border-0">
                <Link
                  href={`/desk/orders/${o.id}`}
                  className={`flex flex-col gap-1.5 px-4 py-4 hover:bg-surface sm:px-5 ${ROW_GRID} lg:items-center lg:gap-4`}
                >
                  <span className="font-semibold">{o.number}</span>
                  <span className="min-w-0 truncate text-sm">
                    {o.retailer.shopName}
                    <span className="text-muted"> · {o.retailer.city}</span>
                  </span>
                  <span className="text-sm text-muted">{formatDateTime(o.createdAt)}</span>
                  <span className="text-sm text-muted">
                    {o._count.lines} {o._count.lines === 1 ? "item" : "items"}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <DeskStatus status={o.status} />
                    {o.source === "AI_TEXT" && (
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
                        AI captured
                      </span>
                    )}
                    {o.status === "ON_HOLD" && o.holdReason && (
                      <span className="text-sm font-medium text-amber-800">{o.holdReason}</span>
                    )}
                  </span>
                  <span className="text-lg font-semibold lg:text-right">{formatPaise(o.totalPaise)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
