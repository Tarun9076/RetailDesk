import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AddShopForm } from "@/components/desk/add-shop-form";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export default async function NewShopPage() {
  await requireDesk();
  const salesmen = await db.user.findMany({
    where: { role: "SALESMAN", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <Link href="/desk/shops" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Shops
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add a shop</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        The owner can sign in straight away with an SMS code on the number below. The shop has the dealer prices until
        you set its own.
      </p>
      <AddShopForm salesmen={salesmen} />
    </div>
  );
}
