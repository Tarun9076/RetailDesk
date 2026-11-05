"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmt, plural, type Dict } from "@/lib/i18n/dict";
import { formatPaise } from "@/lib/money";
import { useCart } from "./cart-provider";

/**
 * The cart, always one thumb-tap away while browsing: how many things, and the total. It floats
 * above the content as a single rounded bar, so the catalogue behind it stays visible and calm.
 */
export function CartBar({ t }: { t: Dict["catalogue"] }) {
  const { count, priced } = useCart();
  const pathname = usePathname();
  if (count === 0 || pathname !== "/catalogue") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <Link
        href="/cart"
        className="pointer-events-auto mx-auto flex min-h-14 max-w-xl items-center justify-between gap-3 rounded-2xl bg-accent pl-5 pr-4 text-white shadow-[0_10px_30px_rgba(20,82,54,0.35)] transition-colors hover:bg-accent-strong active:bg-accent-strong"
      >
        <span className="min-w-0 truncate text-[15px] font-medium">
          {fmt(plural(count, t.itemsOne, t.items), { n: count })}
          <span className="hidden min-[400px]:inline"> · {t.viewCart}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-lg font-semibold tabular-nums">
          {formatPaise(priced.totalPaise)}
          <ChevronRight size={20} aria-hidden className="opacity-80" />
        </span>
      </Link>
    </div>
  );
}
