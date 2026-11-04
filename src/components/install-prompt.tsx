"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Dict } from "@/lib/i18n/dict";

// The browser's own install prompt event; it is not in the standard DOM types yet.
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "rd_install_dismissed";

type Env = "server" | "installed" | "dismissed" | "ios" | "other";

/** What this phone and browser are, read once on the client. A plain string, so it is a stable snapshot. */
function readEnv(): Env {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  try {
    if (localStorage.getItem(DISMISSED_KEY) === "1") return "dismissed";
  } catch {
    /* storage blocked: show it */
  }
  const ua = navigator.userAgent;
  // iPhones have no install event, so they get a manual instruction instead.
  if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua)) return "ios";
  return "other";
}

const noSubscription = () => () => undefined;

/** A quiet banner, shown once, only when the phone can actually install the app. */
export function InstallPrompt({ t }: { t: Dict["install"] }) {
  const env = useSyncExternalStore(noSubscription, readEnv, () => "server" as Env);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setClosed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    setEvent(null);
    setClosed(true);
  }

  const canShow = env === "other" || env === "ios";
  if (closed || !canShow || (!event && env !== "ios")) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      <Download size={20} aria-hidden className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t.title}</p>
        <p className="text-sm text-muted">{event ? t.body : t.ios}</p>
        {event && (
          <button
            type="button"
            onClick={install}
            className="mt-3 min-h-11 rounded-xl bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            {t.button}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.later}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-bg"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
