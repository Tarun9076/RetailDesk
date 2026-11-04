"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps the order queue current without anyone pressing reload: every 30
 * seconds while the tab is visible, and straight away when the desk comes back to it.
 */
export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, everyMs]);
  return null;
}
