import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

// No web fonts on purpose. Measured on a production build, Noto Sans cost about
// 300 KB on every first load (the rupee sign alone pulled in a 164 KB file), which
// is most of a slow-3G budget. Every target phone already has a good sans-serif and
// Hindi support, so the font stack in globals.css costs nothing.

export const metadata: Metadata = {
  title: "RetailDesk",
  description: "Order from your distributor in a minute: stock, your price and schemes in one place.",
  icons: {
    icon: [{ url: "/pwa-icon/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/pwa-icon/180", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "RetailDesk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b6b47",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
