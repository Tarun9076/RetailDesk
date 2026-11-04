"use client";

import { CloudOff, LogOut, RefreshCw, Store, ClipboardList, TriangleAlert, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DownloadAppButton } from "@/components/install/download-app-button";
import { Button } from "@/components/ui";
import { timeAgo } from "@/lib/field/ago";
import { isStale, isUnsent, type QueuedOrder } from "@/lib/field/queue";
import {
  getActiveUser,
  getPendingLogout,
  listQueue,
  loadSnapshot,
  pruneQueue,
  setActiveUser,
  setPendingLogout,
  wipeForSignOut,
  type ActiveUser,
} from "@/lib/field/store";
import { downloadSnapshot, flushQueue, storeSnapshot } from "@/lib/field/sync";
import type { FieldSnapshot } from "@/lib/field/types";
import type { Dict, Lang } from "@/lib/i18n/dict";
import { FieldContext, type FieldContextValue } from "./field-context";
import { OrdersView } from "./orders-view";
import { ShopView } from "./shop-view";
import { ShopsView } from "./shops-view";

type Phase = "loading" | "ready" | "needs_connection" | "signed_out";

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const getHash = () => window.location.hash;
const getServerHash = () => "";

function parseRoute(hash: string): { name: "shops" } | { name: "orders" } | { name: "shop"; id: string; cart: boolean } {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "orders") return { name: "orders" };
  if (parts[0] === "shop" && parts[1]) return { name: "shop", id: decodeURIComponent(parts[1]), cart: parts[2] === "cart" };
  return { name: "shops" };
}

export function FieldApp({
  lang,
  t,
  tInstall,
  appName,
  signOutLabel,
}: {
  lang: Lang;
  t: Dict["catalogue"];
  tInstall: Dict["install"];
  appName: string;
  signOutLabel: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<ActiveUser | null>(null);
  const [snapshot, setSnapshot] = useState<FieldSnapshot | null>(null);
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const userRef = useRef<ActiveUser | null>(null);
  const syncingRef = useRef(false);

  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const route = parseRoute(hash);

  const go = useCallback((h: string) => {
    window.location.hash = h;
  }, []);

  const reloadQueue = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    setQueue(await listQueue(u.id));
  }, []);

  /** Sends waiting orders, then downloads fresh shops, prices, stock and credit. */
  const syncNow = useCallback(async () => {
    const u = userRef.current;
    if (!u || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const flushed = await flushQueue(u.id, () => void reloadQueue());
      await reloadQueue();
      if (flushed.stoppedBecause === "offline") return setOnline(false);
      if (flushed.stoppedBecause === "signed_out") return setPhase("signed_out");
      const res = await downloadSnapshot();
      if (res.ok && res.snapshot.salesman.id === u.id) {
        await storeSnapshot(u.id, res.snapshot);
        setSnapshot(res.snapshot);
        setOnline(true);
      } else if (!res.ok && res.reason === "offline") {
        setOnline(false);
      } else if (!res.ok && res.reason === "signed_out") {
        setPhase("signed_out");
      }
      await pruneQueue(u.id);
      await reloadQueue();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [reloadQueue]);

  // Start-up: finish an offline sign-out, work out who is signed in, load their data.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await getPendingLogout()) {
          const ok = await fetch("/api/auth/logout", { method: "POST" }).then((r) => r.ok).catch(() => false);
          if (ok) {
            await setPendingLogout(false);
            window.location.replace("/login");
          } else if (alive) setPhase("signed_out");
          return;
        }

        const res = navigator.onLine ? await downloadSnapshot() : ({ ok: false, reason: "offline" } as const);
        const active = await getActiveUser();
        if (!alive) return;

        if (res.ok) {
          const me = res.snapshot.salesman;
          // A different salesman on this phone: the last one's shops and prices go. Their unsent orders stay, unreadable to anyone else.
          if (active && active.id !== me.id) await wipeForSignOut(active.id);
          await storeSnapshot(me.id, res.snapshot);
          await setActiveUser(me);
          userRef.current = me;
          setUser(me);
          setSnapshot(res.snapshot);
          setOnline(true);
        } else if (res.reason === "signed_out") {
          window.location.replace("/login");
          return;
        } else {
          setOnline(false);
          const stored = active ? await loadSnapshot(active.id) : null;
          if (!active || !stored) return setPhase("needs_connection");
          userRef.current = active;
          setUser(active);
          setSnapshot(stored);
        }
        await reloadQueue();
        setPhase("ready");
        if (res.ok) void syncNow();
      } catch {
        if (alive) setPhase("needs_connection"); // storage blocked (for example a private window)
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadQueue, syncNow]);

  // Come back online, or return to the app: send what is waiting.
  useEffect(() => {
    if (phase !== "ready") return;
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    const visible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void syncNow();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", visible);
    // Browsers do not always announce that the signal is back (weak or captive networks), so while offline we simply try again often.
    const timer = setInterval(visible, online ? 3 * 60_000 : 15_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [phase, syncNow, online]);

  // Ask the service worker to keep this screen's own files, so the app opens with no signal.
  useEffect(() => {
    if (phase !== "ready" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((n) => n.includes("/_next/static/"));
        reg.active?.postMessage({ type: "WARM", urls: [...new Set(urls)] });
      })
      .catch(() => undefined);
  }, [phase]);

  const unsent = useMemo(() => queue.filter(isUnsent), [queue]);
  const attention = useMemo(() => queue.filter((o) => o.status === "needs_attention"), [queue]);

  async function doSignOut() {
    if (!user) return;
    setSigningOut(true);
    await wipeForSignOut(user.id);
    const ok = await fetch("/api/auth/logout", { method: "POST" }).then((r) => r.ok).catch(() => false);
    if (!ok) {
      // No signal: the cookie cannot be cleared yet. Remember to do it the next time the app is online.
      await setPendingLogout(true);
      userRef.current = null;
      setUser(null);
      setSnapshot(null);
      setConfirmSignOut(false);
      setSigningOut(false);
      setPhase("signed_out");
      return;
    }
    window.location.replace("/login");
  }

  if (phase === "loading") {
    return <div className="grid min-h-dvh place-items-center text-muted" aria-busy="true">Loading your shops…</div>;
  }

  if (phase === "needs_connection" || phase === "signed_out" || !user || !snapshot) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <CloudOff size={40} aria-hidden className="text-muted" />
        <h1 className="mt-4 text-xl font-semibold">
          {phase === "signed_out" ? "Signed out on this phone" : "Connect once to load your shops"}
        </h1>
        <p className="mt-2 text-muted">
          {phase === "signed_out"
            ? "Your shops and prices were removed from this phone. Connect to the internet to finish signing out."
            : "Your shops, prices and stock are saved on the phone the first time you open the app with a connection. After that it works without one."}
        </p>
        <div className="mt-6 w-full">
          <Button type="button" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const ctx: FieldContextValue = { lang, t, snapshot, queue, online, syncing, syncNow, reloadQueue, go };
  const stale = isStale(snapshot.syncedAt);

  const tab = (active: boolean) =>
    `relative flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-3 text-sm font-medium ${
      active ? "border-accent text-accent" : "border-transparent text-muted hover:bg-surface"
    }`;

  return (
    <FieldContext.Provider value={ctx}>
      <header className="sticky-header sticky top-0 z-10 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 py-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          <div className="min-w-[5.75rem] flex-1">
            <p className="whitespace-nowrap text-base font-semibold tracking-tight text-accent">{appName}</p>
            <p className="truncate text-xs text-muted">{user.name} · salesman</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SyncPill online={online} syncing={syncing} unsent={unsent.length} syncedAt={snapshot.syncedAt} onTap={() => void syncNow()} />
            <DownloadAppButton t={tInstall} />
            <button
              type="button"
              aria-label={signOutLabel}
              onClick={() => (unsent.length > 0 || attention.length > 0 ? setConfirmSignOut(true) : void doSignOut())}
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2 text-sm font-medium text-muted hover:bg-surface min-[420px]:px-4"
            >
              <LogOut size={18} aria-hidden className="min-[420px]:hidden" />
              <span className="hidden min-[420px]:inline">{signOutLabel}</span>
            </button>
          </div>
        </div>
        <nav aria-label="Salesman" className="mx-auto flex max-w-6xl pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          <button type="button" className={tab(route.name !== "orders")} onClick={() => go("#/")}>
            <Store size={18} aria-hidden /> My shops
          </button>
          <button type="button" className={tab(route.name === "orders")} onClick={() => go("#/orders")}>
            <ClipboardList size={18} aria-hidden /> Orders
            {unsent.length + attention.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                {unsent.length + attention.length}
              </span>
            )}
          </button>
        </nav>
      </header>

      {!online && (
        <p role="status" className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          <WifiOff size={16} aria-hidden /> You are offline. Orders are saved on this phone and sent when you are back online.
        </p>
      )}
      {stale && (
        <p role="status" className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          <TriangleAlert size={16} aria-hidden /> Prices were last updated {timeAgo(snapshot.syncedAt)}. Connect to refresh them before a busy day.
        </p>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 sm:px-6">
        {route.name === "orders" ? (
          <OrdersView />
        ) : route.name === "shop" ? (
          <ShopView shopId={route.id} showCart={route.cart} />
        ) : (
          <ShopsView />
        )}
      </main>

      {confirmSignOut && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="so-title">
          <div className="w-full max-w-md rounded-2xl bg-bg p-5">
            <h2 id="so-title" className="text-lg font-semibold">
              {unsent.length} {unsent.length === 1 ? "order has" : "orders have"} not been sent
            </h2>
            <p className="mt-2 text-sm text-muted">
              Signing out removes your shops and prices from this phone. The unsent orders stay on it, hidden from
              anyone else, and go to the office the next time you sign in here.
            </p>
            <div className="mt-5 space-y-2">
              {online && (
                <Button
                  type="button"
                  disabled={syncing}
                  onClick={async () => {
                    await syncNow();
                    setConfirmSignOut(false);
                  }}
                >
                  {syncing ? "Sending…" : "Send them now"}
                </Button>
              )}
              <Button type="button" variant="ghost" disabled={signingOut} onClick={() => void doSignOut()}>
                Sign out and keep them
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmSignOut(false)}>
                Stay signed in
              </Button>
            </div>
          </div>
        </div>
      )}
    </FieldContext.Provider>
  );
}

function SyncPill({
  online,
  syncing,
  unsent,
  syncedAt,
  onTap,
}: {
  online: boolean;
  syncing: boolean;
  unsent: number;
  syncedAt: string;
  onTap: () => void;
}) {
  const label = syncing
    ? "Syncing…"
    : !online
      ? unsent > 0
        ? `Offline · ${unsent} unsent`
        : "Offline"
      : unsent > 0
        ? `${unsent} to send`
        : `Synced ${timeAgo(syncedAt)}`;
  const tone = !online ? "bg-amber-100 text-amber-900" : unsent > 0 ? "bg-amber-100 text-amber-900" : "bg-accent-soft text-accent";
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={syncing || !online}
      aria-label={`${label}. Tap to sync now`}
      className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${tone}`}
    >
      <RefreshCw size={14} aria-hidden className={syncing ? "animate-spin" : ""} />
      <span className="hidden min-[400px]:inline whitespace-nowrap">{label}</span>
    </button>
  );
}
