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
    <nav aria-label="Main" className="border-b border-line print:hidden">
      <div className="no-scrollbar mx-auto flex max-w-6xl gap-5 overflow-x-auto pl-[max(1rem,env(safe-area-inset-left))] pr-4 sm:gap-7 sm:px-6">
        {tabs.map((tab) => {
          const active = tab.match.some((m) => pathname.startsWith(m));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center border-b-2 text-[15px] font-medium transition-colors ${
                active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
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
