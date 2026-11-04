"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CatalogueItem } from "@/lib/catalogue-types";
import type { Lang } from "@/lib/i18n/dict";
import { maxOrderableCases, priceOrder } from "@/lib/pricing/engine";
import type { PricedLine, PricedOrder } from "@/lib/pricing/types";

type Qty = Record<string, number>;

interface CartContextValue {
  items: CatalogueItem[];
  lang: Lang;
  qty: Qty;
  hydrated: boolean; // false until the saved cart has been read from storage
  count: number; // distinct products in the cart
  priced: PricedOrder;
  lineFor: (skuId: string) => PricedLine | undefined;
  setQty: (skuId: string, n: number) => void;
  /** Adds cases on top of what is already in the cart (used by "order by message"). */
  addMany: (add: Qty) => void;
  replace: (next: Qty) => void;
  clear: () => void;
  /** The reviewed AI capture this cart was built from, sent with the order. */
  captureId: string | null;
  setCaptureId: (id: string | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function CartProvider({
  retailerId,
  items,
  lang,
  children,
}: {
  retailerId: string;
  items: CatalogueItem[];
  lang: Lang;
  children: React.ReactNode;
}) {
  const storageKey = `rd_cart:${retailerId}`;
  const [qty, setQtyState] = useState<Qty>({});
  const [hydrated, setHydrated] = useState(false);
  const [captureId, setCaptureIdState] = useState<string | null>(null);
  const captureKey = `rd_capture:${retailerId}`;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const clampTo = useCallback(
    (skuId: string, n: number) => {
      const item = byId.get(skuId);
      if (!item || !Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(Math.floor(n), maxOrderableCases(item.stockCases, item.scheme)));
    },
    [byId],
  );

  // Restore after mount (localStorage is not available during server render).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Qty;
      const cleaned: Qty = {};
      for (const [id, n] of Object.entries(saved)) {
        const c = clampTo(id, Number(n));
        if (c > 0) cleaned[id] = c;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted state
      setQtyState(cleaned);
      const cap = localStorage.getItem(captureKey);
      if (cap && Object.keys(cleaned).length > 0) setCaptureIdState(cap);
    } catch {
      /* private mode or corrupt data: start with an empty cart */
    }
    setHydrated(true);
  }, [storageKey, captureKey, clampTo]);

  const setCaptureId = useCallback(
    (id: string | null) => {
      setCaptureIdState(id);
      try {
        if (id) localStorage.setItem(captureKey, id);
        else localStorage.removeItem(captureKey);
      } catch {
        /* ignore */
      }
    },
    [captureKey],
  );

  const persist = useCallback(
    (next: Qty) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage full or blocked: the cart still works for this visit */
      }
    },
    [storageKey],
  );

  const setQty = useCallback(
    (skuId: string, n: number) => {
      setQtyState((prev) => {
        const c = clampTo(skuId, n);
        const next = { ...prev };
        if (c > 0) next[skuId] = c;
        else delete next[skuId];
        persist(next);
        return next;
      });
    },
    [clampTo, persist],
  );

  const replace = useCallback(
    (incoming: Qty) => {
      const next: Qty = {};
      for (const [id, n] of Object.entries(incoming)) {
        const c = clampTo(id, n);
        if (c > 0) next[id] = c;
      }
      persist(next);
      setQtyState(next);
      // A different cart is no longer the one the AI reading described.
      setCaptureId(null);
    },
    [clampTo, persist, setCaptureId],
  );

  const addMany = useCallback(
    (add: Qty) => {
      setQtyState((prev) => {
        const next = { ...prev };
        for (const [id, n] of Object.entries(add)) {
          const c = clampTo(id, (next[id] ?? 0) + n);
          if (c > 0) next[id] = c;
        }
        persist(next);
        return next;
      });
    },
    [clampTo, persist],
  );

  const clear = useCallback(() => replace({}), [replace]);

  const priced = useMemo(
    () =>
      priceOrder(
        items
          .filter((i) => (qty[i.id] ?? 0) > 0)
          .map((i) => ({
            skuId: i.id,
            qtyCases: qty[i.id],
            unitPricePaise: i.unitPricePaise,
            piecesPerCase: i.piecesPerCase,
            gstRateBp: i.gstRateBp,
            stockCases: i.stockCases,
            scheme: i.scheme,
          })),
      ),
    [items, qty],
  );

  const lineMap = useMemo(() => new Map(priced.lines.map((l) => [l.skuId, l])), [priced]);
  const lineFor = useCallback((id: string) => lineMap.get(id), [lineMap]);

  const value = useMemo(
    () => ({
      items, lang, qty, hydrated, count: priced.lines.length, priced, lineFor,
      setQty, addMany, replace, clear, captureId, setCaptureId,
    }),
    [items, lang, qty, hydrated, priced, lineFor, setQty, addMany, replace, clear, captureId, setCaptureId],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
