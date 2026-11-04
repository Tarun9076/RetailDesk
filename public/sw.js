/*
 * RetailDesk service worker. It does three small things:
 *   1. shows a friendly offline page when a page cannot be loaded
 *   2. keeps the app's own static files (scripts, styles, icons) on the phone,
 *      so repeat visits on slow 3G are fast
 *   3. keeps the salesman app's shell (/sales) so it opens with no signal
 *
 * It never stores API answers or anything about a shop: prices, credit and
 * orders always come fresh from the server. The /sales shell is the one page
 * it keeps, and that page contains no shop, price or person: the salesman's
 * data lives in the app's own on-phone database, deleted at sign out.
 */
const VERSION = "v3";
const CACHE = `retaildesk-static-${VERSION}`;
// A plain HTML file, not a Next.js page: it is shown under any address, and a
// framework page would try to correct the address mismatch and reload in a loop.
const OFFLINE_URL = "/offline.html";
const SHELL_URL = "/sales";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/pwa-icon/192"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The app asks us to keep the files it has just loaded, because the very
// first visit happens before this worker is in charge of the page.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "WARM" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls
          .filter((u) => typeof u === "string")
          .map((u) => {
            const url = new URL(u, self.location.origin);
            if (url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return null;
            return cache
              .match(url.href)
              .then((hit) => hit || fetch(url.href).then((res) => (res.ok ? cache.put(url.href, res) : undefined)))
              .catch(() => undefined);
          }),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never touch the API

  if (req.mode === "navigate") {
    const isShell = url.pathname === SHELL_URL;
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep the shell only when it really is the page (not a redirect to sign-in).
          if (isShell && res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(SHELL_URL, copy));
          }
          return res;
        })
        .catch(() =>
          // The installed app opens at "/": on a phone that has the shell, that means the salesman app.
          (isShell || url.pathname === "/" ? caches.match(SHELL_URL) : Promise.resolve(undefined)).then(
            (hit) => hit || caches.match(OFFLINE_URL),
          ),
        ),
    );
    return;
  }

  // Build output has a hash in its name, so a cached copy is never stale.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
