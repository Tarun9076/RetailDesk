import { CatalogueView } from "@/components/retailer/catalogue-view";
import { requireRetailer } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";
import { getCreditPosition } from "@/lib/orders/exposure";
import { formatPaise } from "@/lib/money";

export default async function CataloguePage() {
  const { retailer } = await requireRetailer();
  const [{ t }, credit] = await Promise.all([getDict(), getCreditPosition(retailer.id)]);
  const over = credit.availablePaise < 0;
  return (
    <>
      {/* The one number a shopkeeper needs before ordering: what they can still take on credit. */}
      <p className="mb-4 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{t.catalogue.credit}</span>
        <span className={`text-base font-semibold tabular-nums ${over ? "text-danger" : "text-ink"}`}>
          {formatPaise(credit.availablePaise)}
        </span>
      </p>
      <CatalogueView t={t.catalogue} />
    </>
  );
}
