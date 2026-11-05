import { MessageCircle, Phone, Store } from "lucide-react";
import Link from "next/link";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import {
  QUIET_AFTER_DAYS,
  LOST_AFTER_DAYS,
  countByBucket,
  dormant,
  toRows,
  type Bucket,
  type ShopRow,
} from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { loadShopActivity } from "@/lib/orders/shops";

const FILTERS = [
  { key: "14", label: `No order in ${QUIET_AFTER_DAYS}+ days`, min: QUIET_AFTER_DAYS },
  { key: "30", label: `${LOST_AFTER_DAYS}+ days`, min: LOST_AFTER_DAYS },
  { key: "all", label: "All shops", min: 0 },
  { key: "off", label: "Switched off", min: 0 },
];

const BUCKET_STYLE: Record<Bucket, string> = {
  active: "bg-accent-soft text-accent",
  quiet: "bg-amber-100 text-amber-900",
  lost: "bg-danger-soft text-danger",
  never: "bg-surface text-muted",
};

function agoText(row: ShopRow): string {
  if (row.days === null) return "Never ordered";
  if (row.days === 0) return "Ordered today";
  return `${row.days} ${row.days === 1 ? "day" : "days"} ago`;
}

/** wa.me wants digits only, with the country code. */
const waLink = (row: ShopRow) =>
  `https://wa.me/${row.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Namaste ${row.ownerName} ji, ab aap RetailDesk app par 1 minute mein order de sakte hain. Stock, aapka rate aur scheme sab dikhta hai.`,
  )}`;

export default async function ShopsPage(props: PageProps<"/desk/shops">) {
  await requireDesk();
  const { show, added } = await props.searchParams;
  const filter = FILTERS.find((f) => f.key === show) ?? FILTERS[0];

  const now = new Date();
  const rows = toRows(await loadShopActivity(now), now);
  const counts = countByBucket(rows);
  const list =
    filter.key === "off"
      ? []
      : filter.key === "all"
        ? [...rows].sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
        : dormant(rows, filter.min);
  const switchedOff =
    filter.key === "off"
      ? await db.retailer.findMany({ where: { active: false }, select: { id: true, shopName: true, name: true, city: true }, orderBy: { shopName: "asc" } })
      : [];

  const stat = (label: string, n: number, tone: string) => (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{n}</p>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Shops</h1>
        <Link href="/desk/shops/new" className="flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong">
          Add a shop
        </Link>
      </div>
      {added === "1" && (
        <p role="status" className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          Shop added. The owner can sign in with an SMS code on that number.
        </p>
      )}
      <p className="mt-1 text-muted">
        Who has gone quiet. A shop counts as quiet after {QUIET_AFTER_DAYS} days without an order. Cancelled orders do
        not count.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat(`Ordered in the last ${QUIET_AFTER_DAYS} days`, counts.active, "text-accent")}
        {stat(`Quiet ${QUIET_AFTER_DAYS}–${LOST_AFTER_DAYS - 1} days`, counts.quiet, "text-amber-700")}
        {stat(`Quiet ${LOST_AFTER_DAYS}+ days`, counts.lost, "text-danger")}
        {stat("Never ordered", counts.never, "text-muted")}
      </div>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {FILTERS.map((f) => {
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              href={f.key === "14" ? "/desk/shops" : `/desk/shops?show=${f.key}`}
              role="tab"
              aria-selected={active}
              className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                active ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {filter.key === "off" ? (
        switchedOff.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Store size={40} aria-hidden className="text-muted" />
            <p className="mt-4 text-muted">No shop is switched off.</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {switchedOff.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{s.shopName}</p>
                  <p className="text-sm text-muted">{s.name} · {s.city}</p>
                </div>
                <Link href={`/desk/shops/${s.id}`} className="flex min-h-12 items-center rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface">
                  Open and switch on
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Store size={40} aria-hidden className="text-muted" />
          <p className="mt-4 text-muted">Every shop has ordered within the last {QUIET_AFTER_DAYS} days.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {list.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.shopName}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BUCKET_STYLE[r.bucket]}`}>
                    {agoText(r)}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {r.ownerName} · {r.city}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {r.lastOrderAt ? `Last order ${formatDate(r.lastOrderAt)}` : "No orders yet"}
                  {" · "}
                  {r.orders90} {r.orders90 === 1 ? "order" : "orders"} in 90 days
                  {r.value90Paise > 0 && ` (${formatPaise(r.value90Paise)})`}
                  {" · "}
                  credit left {formatPaise(r.availableCreditPaise)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/desk/shops/${r.id}`}
                  className="flex min-h-12 items-center rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface"
                >
                  Edit
                </Link>
                <a
                  href={`tel:${r.phone}`}
                  className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface"
                >
                  <Phone size={16} aria-hidden /> Call
                </a>
                <a
                  href={waLink(r)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong"
                >
                  <MessageCircle size={16} aria-hidden /> WhatsApp
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
