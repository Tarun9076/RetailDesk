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
    // The safe-area padding keeps the logo out from under a phone's notch when the app is installed.
    <header className="sticky-header sticky top-0 z-10 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
      <div
        className={`flex items-center justify-between gap-2 py-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:gap-3 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] ${
          fluid ? "w-full lg:px-8 2xl:px-12" : "mx-auto max-w-6xl"
        }`}
      >
        {/* The name never breaks mid-word; the shop name after it is what gives way. */}
        <div className="min-w-[5.75rem] flex-1">
          <p className="whitespace-nowrap text-base font-semibold tracking-tight text-accent">{t.common.appName}</p>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DownloadAppButton t={t.install} />
          {showLanguage && <LanguageToggle lang={lang} />}
          <SignOutButton label={t.common.signOut} redirectTo={signOutTo} />
        </div>
      </div>
    </header>
  );
}
