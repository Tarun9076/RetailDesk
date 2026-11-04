/*
 * RetailDesk service worker. It does two small things:
 *   1. shows a friendly offline page when a page cannot be loaded
 *   2. keeps the app's own static files (fonts, scripts, icons) on the phone,
 *      so repeat visits on slow 3G are fast
 *
 * It never stores pages, API answers or anything about a shop: prices, credit
 * and orders always come fresh from the server, and a shared phone cannot
 * leak them from a cache.
 */
const VERSION = "v2";
const CACHE = `retaildesk-static-${VERSION}`;
// A plain HTML file, not a Next.js page: it is shown under any address, and a
// framework page would try to correct the address mismatch and reload in a loop.
const OFFLINE_URL = "/offline.html";

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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never touch the API

  // A page that cannot load: the network answer when there is one, else the offline page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
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
