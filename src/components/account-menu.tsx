"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { DownloadAppButton } from "@/components/install/download-app-button";
import type { Dict } from "@/lib/i18n/dict";

/**
 * Install (until the app is installed) and Sign out, both in plain sight: nobody should have to hunt
 * through a menu to leave their account on a shared phone or office computer.
 */
export function AccountMenu({
  t,
  signOutTo,
}: {
  t: Dict;
  signOutTo: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      {/* On the narrowest phones there is no room for it; the install steps are still on the login screen. */}
      <div className="hidden min-[400px]:block">
        <DownloadAppButton t={t.install} />
      </div>
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
          router.replace(signOutTo);
          router.refresh();
        }}
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink hover:bg-surface"
      >
        <LogOut size={16} aria-hidden className="text-muted" />
        {t.common.signOut}
      </button>
    </div>
  );
}
