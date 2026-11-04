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
      {/* A centred column that grows with the screen: phone, tablet, laptop. The bottom padding clears the cart bar and the home indicator. */}
      <main className="mx-auto w-full max-w-6xl flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 sm:px-6">
        {children}
      </main>
      <CartBar t={t.catalogue} />
    </CartProvider>
  );
}
