"use client";
// The phone's own database (IndexedDB). Nothing here is shared with other users:
// every record carries the salesman's id, and every read filters on it.
import type { FieldSnapshot } from "./types";
import { isUnsent, pruneSent, type QueuedOrder } from "./queue";

const DB_NAME = "retaildesk-field";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // One snapshot (shops, prices, stock, credit) per salesman.
        db.createObjectStore("snapshots", { keyPath: "userId" });
        // Small key/value facts: who is signed in on this phone, and a pending sign-out.
        db.createObjectStore("meta", { keyPath: "key" });
        db.createObjectStore("queue", { keyPath: "id" }).createIndex("byUser", "userId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("database blocked"));
    });
    // Do not cache a failure forever (private mode can fail once and work later).
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export interface ActiveUser {
  id: string;
  name: string;
}

export async function getActiveUser(): Promise<ActiveUser | null> {
  const row = await run<{ key: string; value: ActiveUser } | undefined>("meta", "readonly", (s) => s.get("active"));
  return row?.value ?? null;
}
export const setActiveUser = (u: ActiveUser | null) =>
  u
    ? run("meta", "readwrite", (s) => s.put({ key: "active", value: u }))
    : run("meta", "readwrite", (s) => s.delete("active"));

/** Set when the salesman signed out with no connection: the server cookie still has to be cleared. */
export async function getPendingLogout(): Promise<boolean> {
  const row = await run<{ key: string; value: boolean } | undefined>("meta", "readonly", (s) => s.get("pendingLogout"));
  return row?.value === true;
}
export const setPendingLogout = (on: boolean) =>
  on
    ? run("meta", "readwrite", (s) => s.put({ key: "pendingLogout", value: true }))
    : run("meta", "readwrite", (s) => s.delete("pendingLogout"));

export const saveSnapshot = (userId: string, snapshot: FieldSnapshot) =>
  run("snapshots", "readwrite", (s) => s.put({ userId, snapshot }));

export async function loadSnapshot(userId: string): Promise<FieldSnapshot | null> {
  const row = await run<{ userId: string; snapshot: FieldSnapshot } | undefined>("snapshots", "readonly", (s) => s.get(userId));
  return row?.snapshot ?? null;
}

export async function listQueue(userId: string): Promise<QueuedOrder[]> {
  const rows = await run<QueuedOrder[]>("queue", "readonly", (s) => s.index("byUser").getAll(userId));
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const putOrder = (o: QueuedOrder) => run("queue", "readwrite", (s) => s.put(o));
export const deleteOrder = (id: string) => run("queue", "readwrite", (s) => s.delete(id));

/** Drops orders that were sent long ago. Unsent orders are never pruned. */
export async function pruneQueue(userId: string) {
  const all = await listQueue(userId);
  const keep = new Set(pruneSent(all).map((o) => o.id));
  await Promise.all(all.filter((o) => !keep.has(o.id)).map((o) => deleteOrder(o.id)));
}

/**
 * Signing out on a shared phone. The shops, prices, credit and stock are
 * deleted. Orders that have not reached the server are kept, because they
 * are the salesman's work, but nobody else can see or send them: reads are
 * filtered by user id and the server only accepts them from that salesman.
 */
export async function wipeForSignOut(userId: string): Promise<{ keptUnsent: number }> {
  await run("snapshots", "readwrite", (s) => s.delete(userId));
  await setActiveUser(null);
  const all = await listQueue(userId);
  await Promise.all(all.filter((o) => !isUnsent(o) && o.status !== "needs_attention").map((o) => deleteOrder(o.id)));
  // Carts live in localStorage, keyed by shop: remove them all.
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("rd_cart:") || k.startsWith("rd_capture:")) localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable: nothing to remove */
  }
  return { keptUnsent: all.filter(isUnsent).length };
}
