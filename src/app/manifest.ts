import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RetailDesk",
    short_name: "RetailDesk",
    description: "Order from your distributor in a minute: stock, your price and schemes in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1b6b47",
    lang: "en-IN",
    categories: ["business", "shopping"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon for the three things a shopkeeper does most.
    shortcuts: [
      { name: "Order by message", url: "/capture" },
      { name: "My cart", url: "/cart" },
      { name: "My orders", url: "/orders" },
    ],
  };
}
