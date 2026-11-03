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
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft"
    >
      <RotateCcw size={16} aria-hidden />
      {label}
    </button>
  );
}
