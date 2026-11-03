import { LanguageToggle } from "@/components/language-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { getDict } from "@/lib/i18n/server";

export async function AppHeader({
  subtitle,
  signOutTo,
}: {
  subtitle: string;
  signOutTo: string;
}) {
  const { lang, t } = await getDict();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-accent">{t.common.appName}</p>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle lang={lang} />
          <SignOutButton label={t.common.signOut} redirectTo={signOutTo} />
        </div>
      </div>
    </header>
  );
}
