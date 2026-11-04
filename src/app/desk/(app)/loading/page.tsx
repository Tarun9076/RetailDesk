import Link from "next/link";
import { PrintButton } from "@/components/desk/print-button";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTimeLong } from "@/lib/format";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export default async function LoadingListPage(props: PageProps<"/desk/loading">) {
  await requireDesk();
  const { show } = await props.searchParams;
  const exported = show === "exported";

  const orders = await db.order.findMany({
    where: exported
      ? { status: "EXPORTED", exportedAt: { gte: daysAgo(3) } }
      : { status: "CONFIRMED" },
    include: { retailer: true, lines: { include: { sku: true } } },
    orderBy: [{ retailer: { city: "asc" } }, { createdAt: "asc" }],
  });

  // Totals per product: what to pick from the godown.
  const byProduct = new Map<string, { code: string; name: string; piecesPerCase: number; paid: number; free: number }>();
  // Stops per shop: what goes off the van at each door.
  const byShop = new Map<string, { shop: string; city: string; numbers: string[]; items: { name: string; paid: number; free: number }[] }>();

  for (const o of orders) {
    const stop = byShop.get(o.retailerId) ?? { shop: o.retailer.shopName, city: o.retailer.city, numbers: [], items: [] };
    stop.numbers.push(o.number);
    byShop.set(o.retailerId, stop);

    for (const l of o.lines) {
      const p = byProduct.get(l.skuId) ?? {
        code: l.sku.code,
        name: l.sku.name,
        piecesPerCase: l.sku.piecesPerCase,
        paid: 0,
        free: 0,
      };
      p.paid += l.qtyCases;
      p.free += l.freeCases;
      byProduct.set(l.skuId, p);

      const existing = stop.items.find((i) => i.name === l.sku.name);
      if (existing) {
        existing.paid += l.qtyCases;
        existing.free += l.freeCases;
      } else {
        stop.items.push({ name: l.sku.name, paid: l.qtyCases, free: l.freeCases });
      }
    }
  }

  const products = [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name));
  const stops = [...byShop.values()];
  const totalCases = products.reduce((s, p) => s + p.paid + p.free, 0);

  const tab = (active: boolean) =>
    `flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
      active ? "border-accent bg-accent text-white" : "border-line bg-bg text-muted hover:bg-surface"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Van loading list</h1>
          <p className="mt-1 text-sm text-muted">
            {orders.length} {orders.length === 1 ? "order" : "orders"} · {totalCases} cases to load · printed{" "}
            {formatDateTimeLong(new Date())}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        <Link href="/desk/loading" className={tab(!exported)}>
          Confirmed
        </Link>
        <Link href="/desk/loading?show=exported" className={tab(exported)}>
          Exported, last 3 days
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-line p-8 text-center text-muted">
          {exported ? "Nothing was exported in the last 3 days." : "No confirmed orders to load yet."}
        </p>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Pick from the godown</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-surface text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 text-right font-medium">Cases</th>
                    <th className="px-4 py-3 text-right font-medium">Free</th>
                    <th className="px-4 py-3 text-right font-medium">Total cases</th>
                    <th className="px-4 py-3 text-right font-medium">Pieces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {products.map((p) => (
                    <tr key={p.code}>
                      <td className="px-4 py-3">
                        <span className="font-medium">{p.name}</span>
                        <span className="block text-xs text-muted">{p.code}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{p.paid}</td>
                      <td className="px-4 py-3 text-right">{p.free || "–"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{p.paid + p.free}</td>
                      <td className="px-4 py-3 text-right text-muted">{(p.paid + p.free) * p.piecesPerCase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Drops by shop</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {stops.map((s, i) => (
                <li key={s.numbers[0]} className="break-inside-avoid rounded-2xl border border-line p-4">
                  <p className="font-semibold">
                    {i + 1}. {s.shop}
                  </p>
                  <p className="text-sm text-muted">
                    {s.city} · {s.numbers.join(", ")}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {s.items.map((it) => (
                      <li key={it.name} className="flex justify-between gap-3">
                        <span className="min-w-0">{it.name}</span>
                        <span className="shrink-0 font-medium">
                          {it.paid}
                          {it.free > 0 && <span className="text-accent"> +{it.free}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
