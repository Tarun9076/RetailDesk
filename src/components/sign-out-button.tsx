"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

/** An icon alone on a narrow phone (so the logo keeps its room), icon and word from a larger screen. */
export function SignOutButton({ label, redirectTo }: { label: string; redirectTo: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace(redirectTo);
        router.refresh();
      }}
      className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2 text-sm font-medium text-muted hover:bg-surface min-[420px]:px-4"
    >
      <LogOut size={18} aria-hidden className="min-[420px]:hidden" />
      <span className="hidden min-[420px]:inline">{label}</span>
    </button>
  );
}
