"use client";

import { useEffect } from "react";

/** Registers the service worker in production only, so development is never confused by a cache. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => undefined); // the app works without it
  }, []);
  return null;
}
