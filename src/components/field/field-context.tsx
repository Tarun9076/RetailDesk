"use client";

import { createContext, useContext } from "react";
import type { Dict, Lang } from "@/lib/i18n/dict";
import type { FieldDict } from "@/lib/i18n/field";
import type { QueuedOrder } from "@/lib/field/queue";
import type { FieldSnapshot } from "@/lib/field/types";

export interface FieldContextValue {
  lang: Lang;
  /** Product-card and catalogue words (shared with the shop app). */
  t: Dict["catalogue"];
  /** The salesman screens' own words. */
  f: FieldDict;
  snapshot: FieldSnapshot;
  queue: QueuedOrder[];
  online: boolean;
  syncing: boolean;
  /** Sends waiting orders and re-downloads shops, prices, stock and credit. */
  syncNow: () => Promise<void>;
  reloadQueue: () => Promise<void>;
  go: (hash: string) => void;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useField() {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error("useField must be used inside the field app");
  return ctx;
}
