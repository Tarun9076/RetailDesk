import { DownloadAppButton } from "@/components/install/download-app-button";
import { LanguageToggle } from "@/components/language-toggle";
import { getDict } from "@/lib/i18n/server";

/** Centered, uncluttered frame shared by both sign-in screens. */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getDict();
  return (
    <main className="flex min-h-dvh flex-col px-4 pb-8 pt-4 sm:px-6">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-2">
        <span className="text-lg font-semibold tracking-tight text-accent">{t.common.appName}</span>
        <div className="flex items-center gap-1">
          <DownloadAppButton t={t.install} />
          <LanguageToggle lang={lang} />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {children}
      </div>
    </main>
  );
}
