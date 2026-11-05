import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProductForm } from "@/components/desk/catalogue/product-form";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export default async function NewProductPage() {
  await requireDesk();
  const brands = (await db.sku.findMany({ distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } })).map((b) => b.brand);
  return (
    <div>
      <Link href="/desk/catalogue" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Catalogue
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add a product</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Add the product, then add its schemes and any shop-specific prices on the next page. Shopkeepers see it as soon as it is saved.
      </p>
      <div className="mt-6 max-w-4xl">
        <ProductForm
          mode="create"
          brands={brands}
          initial={{ code: "", name: "", nameHi: "", imageUrl: "", brand: "", piecesPerCase: 0, pricePaise: null, gstRateBp: 1200, active: true }}
        />
      </div>
    </div>
  );
}
