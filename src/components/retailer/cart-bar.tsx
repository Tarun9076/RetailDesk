"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmt, plural, type Dict } from "@/lib/i18n/dict";
import { formatPaise } from "@/lib/money";
import { useCart } from "./cart-provider";

/** Sticky summary so the cart is always one tap away while browsing. */
export function CartBar({ t }: { t: Dict["catalogue"] }) {
  const { count, priced } = useCart();
  const pathname = usePathname();
  if (count === 0 || pathname !== "/catalogue") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <Link
        href="/cart"
        className="mx-auto flex min-h-14 max-w-5xl items-center justify-between rounded-xl bg-accent px-5 text-white hover:bg-accent-strong"
      >
        <span className="flex items-center gap-2 font-medium">
          <ShoppingBag size={20} aria-hidden />
          {fmt(plural(count, t.itemsOne, t.items), { n: count })} · {t.viewCart}
        </span>
        <span className="text-lg font-semibold">{formatPaise(priced.totalPaise)}</span>
      </Link>
    </div>
  );
}
