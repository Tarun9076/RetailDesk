import Link from "next/link";
import { AssignSalesman } from "@/components/desk/assign-salesman";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";

export default async function SalesmenPage(props: PageProps<"/desk/salesmen">) {
  await requireDesk();
  const { show } = await props.searchParams;
  const showAll = show === "all";
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);

  const [salesmen, shopCounts, orders, shops] = await Promise.all([
    db.user.findMany({ where: { role: "SALESMAN" }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
    db.retailer.groupBy({ by: ["salesmanId"], _count: { _all: true } }),
    db.order.groupBy({
      by: ["placedById"],
      where: { placedById: { not: null }, status: { not: "CANCELLED" }, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalPaise: true },
    }),
    db.retailer.findMany({
      where: showAll ? {} : { salesmanId: null },
      select: { id: true, shopName: true, name: true, city: true, salesmanId: true },
      orderBy: { shopName: "asc" },
      take: 300,
    }),
  ]);

  const countBy = new Map(shopCounts.map((r) => [r.salesmanId, r._count._all]));
  const ordersBy = new Map(orders.map((r) => [r.placedById, r]));
  const unassigned = countBy.get(null) ?? 0;
  const options = salesmen.map((s) => ({ id: s.id, name: s.name }));

  const tab = (active: boolean) =>
    `flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
      active ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
    }`;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Salesmen</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Each salesman sees only the shops assigned to them, with those shops&apos; own prices and credit, and can take
        orders on their behalf, even with no signal. Orders they take are marked with their name.
      </p>

      <section aria-labelledby="roster" className="mt-6 rounded-2xl border border-line">
        <h2 id="roster" className="sr-only">
          Roster
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Salesman</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Shops</th>
                <th className="px-4 py-3 text-right font-medium">Orders, 30 days</th>
                <th className="px-4 py-3 text-right font-medium">Value, 30 days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {salesmen.map((s) => {
                const o = ordersBy.get(s.id);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted">{s.phone}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{countBy.get(s.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o?._count._all ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPaise(o?._sum.totalPaise ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto" role="tablist">
        <Link href="/desk/salesmen" role="tab" aria-selected={!showAll} className={tab(!showAll)}>
          Shops with no salesman ({unassigned})
        </Link>
        <Link href="/desk/salesmen?show=all" role="tab" aria-selected={showAll} className={tab(showAll)}>
          All shops
        </Link>
      </div>

      {shops.length === 0 ? (
        <p className="py-12 text-center text-muted">Every shop has a salesman.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {shops.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{s.shopName}</p>
                <p className="text-sm text-muted">
                  {s.name} · {s.city}
                </p>
              </div>
              <AssignSalesman shopId={s.id} shopName={s.shopName} current={s.salesmanId} salesmen={options} />
            </li>
          ))}
        </ul>
      )}
      {showAll && shops.length === 300 && <p className="mt-3 text-sm text-muted">Showing the first 300 shops.</p>}
    </div>
  );
}
