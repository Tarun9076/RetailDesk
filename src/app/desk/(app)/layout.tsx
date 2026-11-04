import { AppHeader } from "@/components/app-header";
import { DeskNav } from "@/components/desk/desk-nav";
import { requireDesk } from "@/lib/auth/dal";

export default async function DeskLayout({ children }: LayoutProps<"/desk">) {
  const user = await requireDesk();
  return (
    <>
      {/* The office works in English; the language switch is for shopkeepers. */}
      <AppHeader subtitle={user.name} signOutTo="/desk/login" showLanguage={false} wide />
      <DeskNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}
