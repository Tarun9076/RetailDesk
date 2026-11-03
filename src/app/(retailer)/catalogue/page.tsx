import { CatalogueView } from "@/components/retailer/catalogue-view";
import { requireRetailer } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";
import { getCreditPosition } from "@/lib/orders/exposure";
import { formatPaise } from "@/lib/money";

export default async function CataloguePage() {
  const { retailer } = await requireRetailer();
  const [{ t }, credit] = await Promise.all([getDict(), getCreditPosition(retailer.id)]);
  return (
    <>
      <p className="mb-4 text-sm text-muted">
        {t.catalogue.credit}:{" "}
        <span className={`font-medium ${credit.availablePaise < 0 ? "text-danger" : "text-ink"}`}>
          {formatPaise(credit.availablePaise)}
        </span>
      </p>
      <CatalogueView t={t.catalogue} />
    </>
  );
}
