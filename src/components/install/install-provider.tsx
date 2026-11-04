"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

// The browser's own install prompt event; it is not in the standard DOM types yet.
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Platform = "ios" | "android" | "desktop" | "other";
type Env = "server" | "installed" | Platform;

export interface InstallState {
  /** False until the browser has told us what it is, so nothing flashes on load. */
  known: boolean;
  installed: boolean;
  /** True when the browser can show its own install dialog right now. */
  canPrompt: boolean;
  platform: Platform;
  prompt: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const InstallContext = createContext<InstallState>({
  known: false,
  installed: false,
  canPrompt: false,
  platform: "other",
  prompt: async () => "unavailable",
});

export const useInstall = () => useContext(InstallContext);

/** What this phone or computer is, read once on the client. A plain string, so it is a stable snapshot. */
function readEnv(): Env {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "other";
}

const noSubscription = () => () => undefined;

/**
 * Listens for the install event at the very top of the app. The browser fires
 * it once, early, so a button that mounted later would miss it.
 */
export function InstallProvider({ children }: { children: React.ReactNode }) {
  const env = useSyncExternalStore(noSubscription, readEnv, () => "server" as Env);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installedNow, setInstalledNow] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setEvent(null);
      setInstalledNow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!event) return "unavailable" as const;
    await event.prompt();
    const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setEvent(null); // the browser allows one prompt per event
    if (choice.outcome === "accepted") setInstalledNow(true);
    return choice.outcome;
  }, [event]);

  const value = useMemo<InstallState>(
    () => ({
      known: env !== "server",
      installed: env === "installed" || installedNow,
      canPrompt: event !== null,
      platform: env === "server" || env === "installed" ? "other" : env,
      prompt,
    }),
    [env, event, installedNow, prompt],
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}
