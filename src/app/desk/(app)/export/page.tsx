import { ExportForm, type ExportRow } from "@/components/desk/export-form";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function ExportPage() {
  await requireDesk();

  const [ready, exported] = await Promise.all([
    db.order.findMany({
      where: { status: "CONFIRMED" },
      include: { retailer: { select: { shopName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.order.findMany({
      where: { status: "EXPORTED" },
      include: { retailer: { select: { shopName: true } } },
      orderBy: { exportedAt: "desc" },
      take: 15,
    }),
  ]);

  const rows: ExportRow[] = [...ready, ...exported].map((o) => ({
    id: o.id,
    number: o.number,
    shop: o.retailer.shopName,
    date: formatDateTime(o.createdAt),
    totalPaise: o.totalPaise,
    status: o.status === "CONFIRMED" ? "CONFIRMED" : "EXPORTED",
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Tally export</h1>
      <p className="mb-6 mt-1 text-muted">
        Download confirmed orders as one Tally import file (a Sales voucher per order). Exported orders move out of
        the queue and the shop&apos;s account balance goes up by the order total.
      </p>
      <ExportForm rows={rows} />
    </div>
  );
}
