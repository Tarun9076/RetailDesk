import { AppHeader } from "@/components/app-header";
import { CartBar } from "@/components/retailer/cart-bar";
import { CartProvider } from "@/components/retailer/cart-provider";
import { RetailerNav } from "@/components/retailer/retailer-nav";
import { requireRetailer } from "@/lib/auth/dal";
import { loadCatalogue } from "@/lib/catalogue";
import { getDict } from "@/lib/i18n/server";

export default async function RetailerLayout({ children }: LayoutProps<"/">) {
  const { retailer } = await requireRetailer();
  const [{ lang, t }, items] = await Promise.all([getDict(), loadCatalogue(retailer.id)]);
  return (
    <CartProvider retailerId={retailer.id} items={items} lang={lang}>
      <AppHeader subtitle={retailer.shopName} signOutTo="/login" />
      <RetailerNav t={t.nav} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6">{children}</main>
      <CartBar t={t.catalogue} />
    </CartProvider>
  );
}
