"use client";

import { useRouter } from "next/navigation";

export function SignOutButton({ label, redirectTo }: { label: string; redirectTo: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace(redirectTo);
        router.refresh();
      }}
      className="min-h-11 rounded-full px-4 text-sm font-medium text-muted hover:bg-surface"
    >
      {label}
    </button>
  );
}
