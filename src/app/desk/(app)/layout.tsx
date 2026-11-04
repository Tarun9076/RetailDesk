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
      {/* Side padding grows with the screen, and keeps clear of a phone's notch in landscape. */}
      <main className="w-full flex-1 py-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 lg:px-8 2xl:px-12">
        {children}
      </main>
    </>
  );
}
