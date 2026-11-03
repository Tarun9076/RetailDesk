import { CartView } from "@/components/retailer/cart-view";
import { requireRetailer } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";
import { getCreditPosition } from "@/lib/orders/exposure";

export default async function CartPage() {
  const { retailer } = await requireRetailer();
  const [{ t }, credit] = await Promise.all([getDict(), getCreditPosition(retailer.id)]);
  return <CartView t={t.cart} availableCreditPaise={credit.availablePaise} />;
}
