"use client";

import { EllipsisVertical, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DownloadAppButton } from "@/components/install/download-app-button";
import type { Dict } from "@/lib/i18n/dict";

/**
 * The rarely used things (install the app, sign out) live behind one quiet button, so the top of
 * every screen is the shop's name and the language switch, and nothing else competes with the work.
 */
export function AccountMenu({
  t,
  signOutTo,
}: {
  t: Dict;
  signOutTo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.common.menu}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
      >
        <EllipsisVertical size={20} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 w-60 overflow-hidden rounded-2xl border border-line bg-bg py-1 shadow-[0_8px_30px_rgba(21,33,27,0.12)]"
        >
          <DownloadAppButton t={t.install} variant="menu" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              router.replace(signOutTo);
              router.refresh();
            }}
            className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] text-ink hover:bg-surface"
          >
            <LogOut size={18} aria-hidden className="text-muted" />
            {t.common.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
