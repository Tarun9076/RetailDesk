import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

// One family for Latin and Devanagari; few weights keeps first load light on 3G.
const noto = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RetailDesk",
  description: "Order from your distributor in a minute: stock, your price and schemes in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b6b47",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${noto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
