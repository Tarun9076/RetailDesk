// Matches the ledgers in a Tally export to the shops in the app, and works out what would change.
import type { ParsedLedger } from "./parse";

export interface ShopForMatch {
  id: string;
  shopName: string;
  tallyLedgerName: string | null;
  outstandingPaise: number;
}

export interface BalanceRow {
  retailerId: string;
  shopName: string;
  ledger: string;
  beforePaise: number;
  afterPaise: number;
}

export interface BalanceSummary {
  matched: number;
  changed: number;
  unchanged: number;
  increased: number;
  decreased: number;
  totalBeforePaise: number;
  totalAfterPaise: number;
  /** Ledgers in the file that no shop matches, so nobody's balance moved for them. */
  unmatched: { name: string; paise: number }[];
  /** Ledgers that fit more than one shop. Skipped rather than guessed. */
  ambiguous: { name: string; shops: string[] }[];
  /** Active shops that are not in the file at all. Their balance is left as it is. */
  notInFile: { shopName: string }[];
  /** Ledgers where Tally says we owe the shop. The app holds an amount the shop owes, so these are set to 0. */
  advances: { name: string; paise: number }[];
  skippedRows: { row: number; why: string }[];
}

/** "Gupta  General Store." and "gupta general store" are the same name. & and "and" are the same too. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Each ledger is matched to a shop by the shop's Tally name when it has one, otherwise by its shop name.
 * A name that fits two shops is reported, never guessed. Anything the file does not mention is left alone.
 */
export function matchBalances(
  ledgers: ParsedLedger[],
  shops: ShopForMatch[],
  skippedRows: { row: number; why: string }[] = [],
): { rows: BalanceRow[]; summary: BalanceSummary } {
  // A shop answers to its Tally name if it has one; the plain shop name is only a fallback for shops without one.
  const byKey = new Map<string, ShopForMatch[]>();
  const add = (key: string, s: ShopForMatch) => {
    if (!key) return;
    const list = byKey.get(key) ?? [];
    if (!list.some((x) => x.id === s.id)) list.push(s);
    byKey.set(key, list);
  };
  for (const s of shops) add(normaliseName(s.tallyLedgerName?.trim() ? s.tallyLedgerName : s.shopName), s);

  const rows: BalanceRow[] = [];
  const unmatched: BalanceSummary["unmatched"] = [];
  const ambiguous: BalanceSummary["ambiguous"] = [];
  const advances: BalanceSummary["advances"] = [];
  const seen = new Set<string>();

  for (const l of ledgers) {
    const hit = byKey.get(normaliseName(l.name));
    if (!hit) {
      unmatched.push({ name: l.name, paise: l.paise });
      continue;
    }
    if (hit.length > 1) {
      ambiguous.push({ name: l.name, shops: hit.map((s) => s.shopName) });
      continue;
    }
    const shop = hit[0];
    if (seen.has(shop.id)) continue; // two ledger spellings of one shop: the first one wins
    seen.add(shop.id);
    if (l.paise < 0) advances.push({ name: l.name, paise: l.paise });
    rows.push({
      retailerId: shop.id,
      shopName: shop.shopName,
      ledger: l.name,
      beforePaise: shop.outstandingPaise,
      afterPaise: Math.max(0, l.paise),
    });
  }

  const changed = rows.filter((r) => r.afterPaise !== r.beforePaise);
  const summary: BalanceSummary = {
    matched: rows.length,
    changed: changed.length,
    unchanged: rows.length - changed.length,
    increased: changed.filter((r) => r.afterPaise > r.beforePaise).length,
    decreased: changed.filter((r) => r.afterPaise < r.beforePaise).length,
    totalBeforePaise: rows.reduce((s, r) => s + r.beforePaise, 0),
    totalAfterPaise: rows.reduce((s, r) => s + r.afterPaise, 0),
    unmatched,
    ambiguous,
    notInFile: shops.filter((s) => !seen.has(s.id)).map((s) => ({ shopName: s.shopName })),
    advances,
    skippedRows,
  };
  return { rows, summary };
}
