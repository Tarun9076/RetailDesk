"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/desk", label: "Orders", match: (p: string) => p === "/desk" || p.startsWith("/desk/orders") },
  { href: "/desk/shops", label: "Shops", match: (p: string) => p.startsWith("/desk/shops") },
  { href: "/desk/export", label: "Tally export", match: (p: string) => p.startsWith("/desk/export") },
  { href: "/desk/loading", label: "Loading list", match: (p: string) => p.startsWith("/desk/loading") },
];

export function DeskNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Desk" className="border-b border-line bg-bg print:hidden">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
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
