import { DownloadAppButton } from "@/components/install/download-app-button";
import { LanguageToggle } from "@/components/language-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { dictionaries } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";

export async function AppHeader({
  subtitle,
  signOutTo,
  showLanguage = true,
  fluid = false,
}: {
  subtitle: string;
  signOutTo: string;
  showLanguage?: boolean;
  /** Fill the whole window (the desk) instead of a centred column (shopkeepers). */
  fluid?: boolean;
}) {
  // The desk is English only, whatever language a shopkeeper last chose on this computer.
  const { lang, t } = showLanguage ? await getDict() : { lang: "en" as const, t: dictionaries.en };
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur print:hidden">
      <div
        className={`flex items-center justify-between gap-3 py-2 ${
          fluid ? "w-full px-4 sm:px-6 lg:px-8" : "mx-auto max-w-5xl px-4 sm:px-6"
        }`}
      >
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-accent">{t.common.appName}</p>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <DownloadAppButton t={t.install} />
          {showLanguage && <LanguageToggle lang={lang} />}
          <SignOutButton label={t.common.signOut} redirectTo={signOutTo} />
        </div>
      </div>
    </header>
  );
}
