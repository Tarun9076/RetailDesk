import { AccountMenu } from "@/components/account-menu";
import { LanguageToggle } from "@/components/language-toggle";
import { dictionaries } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";

/**
 * The top of a signed-in screen: who this is for, the language, and one quiet menu. Nothing else, so
 * the first thing under it is always the work.
 */
export async function AppHeader({
  subtitle,
  signOutTo,
  showLanguage = true,
  fluid = false,
  sticky = true,
}: {
  subtitle: string;
  signOutTo: string;
  showLanguage?: boolean;
  /** Fill the whole window (the desk) instead of a centred column (shopkeepers). */
  fluid?: boolean;
  /** False when the caller wraps the header and a tab bar in one sticky block. */
  sticky?: boolean;
}) {
  // The desk is English only, whatever language a shopkeeper last chose on this computer.
  const { lang, t } = showLanguage ? await getDict() : { lang: "en" as const, t: dictionaries.en };
  return (
    // The safe-area padding keeps the logo out from under a phone's notch when the app is installed.
    <header
      className={`pt-[env(safe-area-inset-top)] print:hidden ${sticky ? "sticky-header sticky top-0 z-20 bg-bg/90 backdrop-blur" : ""}`}
    >
      <div
        className={`flex min-h-14 items-center justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] ${
          fluid ? "w-full lg:px-8 2xl:px-12" : "mx-auto max-w-6xl"
        }`}
      >
        {/* The shop's name is what matters to the person holding the phone; the product name is a small mark. */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold leading-tight tracking-tight">{subtitle}</p>
          <p className="text-[11px] font-medium uppercase leading-4 tracking-[0.14em] text-accent">{t.common.appName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showLanguage && <LanguageToggle lang={lang} />}
          <AccountMenu t={t} signOutTo={signOutTo} />
        </div>
      </div>
    </header>
  );
}
