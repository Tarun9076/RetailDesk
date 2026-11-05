"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/desk/dashboard", label: "Dashboard", match: (p: string) => p.startsWith("/desk/dashboard") },
  { href: "/desk", label: "Orders", match: (p: string) => p === "/desk" || p.startsWith("/desk/orders") },
  // Daily work first, then the set-up and admin screens.
  { href: "/desk/export", label: "Export", match: (p: string) => p.startsWith("/desk/export") },
  { href: "/desk/loading", label: "Loading list", match: (p: string) => p.startsWith("/desk/loading") },
  { href: "/desk/shops", label: "Shops", match: (p: string) => p.startsWith("/desk/shops") },
  { href: "/desk/catalogue", label: "Catalogue", match: (p: string) => p.startsWith("/desk/catalogue") },
  { href: "/desk/salesmen", label: "Salesmen", match: (p: string) => p.startsWith("/desk/salesmen") },
  { href: "/desk/balances", label: "Balances", match: (p: string) => p.startsWith("/desk/balances") },
  { href: "/desk/tally", label: "Tally set-up", match: (p: string) => p.startsWith("/desk/tally") },
  { href: "/desk/staff", label: "Staff", match: (p: string) => p.startsWith("/desk/staff") },
  { href: "/desk/system", label: "System", match: (p: string) => p.startsWith("/desk/system") },
];

export function DeskNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Desk" className="border-b border-line bg-bg print:hidden">
      <div className="no-scrollbar flex w-full gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
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
