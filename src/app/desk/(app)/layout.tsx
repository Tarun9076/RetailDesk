import { AppHeader } from "@/components/app-header";
import { DeskNav } from "@/components/desk/desk-nav";
import { requireDesk } from "@/lib/auth/dal";

export default async function DeskLayout({ children }: LayoutProps<"/desk">) {
  const user = await requireDesk();
  return (
    <>
      {/* The office works in English and on a big screen: use the whole window. */}
      <AppHeader subtitle={user.name} signOutTo="/desk/login" showLanguage={false} fluid />
      <DeskNav />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </>
  );
}
