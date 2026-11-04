"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dict } from "@/lib/i18n/dict";

export function RetailerNav({ t }: { t: Dict["nav"] }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/catalogue", label: t.catalogue, match: ["/catalogue", "/cart"] },
    { href: "/capture", label: t.capture, match: ["/capture"] },
    { href: "/orders", label: t.orders, match: ["/orders"] },
  ];
  return (
    <nav aria-label="Main" className="border-b border-line bg-bg">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map((tab) => {
          const active = tab.match.some((m) => pathname.startsWith(m));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 shrink-0 items-center border-b-2 px-4 text-sm font-medium ${
                active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
