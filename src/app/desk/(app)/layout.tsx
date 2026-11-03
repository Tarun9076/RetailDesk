import { AppHeader } from "@/components/app-header";
import { requireDesk } from "@/lib/auth/dal";

export default async function DeskLayout({ children }: LayoutProps<"/desk">) {
  const user = await requireDesk();
  return (
    <>
      <AppHeader subtitle={user.name} signOutTo="/desk/login" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}
