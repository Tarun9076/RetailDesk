"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-provider";

/** Puts a past order's cases into the cart. Quantities are clamped to today's stock. */
export function RepeatOrderButton({
  lines,
  label,
}: {
  lines: { skuId: string; qtyCases: number }[];
  label: string;
}) {
  const router = useRouter();
  const { replace } = useCart();
  return (
    <button
      type="button"
      onClick={() => {
        replace(Object.fromEntries(lines.map((l) => [l.skuId, l.qtyCases])));
        router.push("/cart");
      }}
      // Quiet on purpose: a list of orders is a list of these, and each should not shout.
      className="-ml-3 flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
    >
      <RotateCcw size={16} aria-hidden />
      {label}
    </button>
  );
}
