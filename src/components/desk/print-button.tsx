"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-5 text-sm font-medium hover:bg-surface print:hidden"
    >
      <Printer size={16} aria-hidden /> Print
    </button>
  );
}
