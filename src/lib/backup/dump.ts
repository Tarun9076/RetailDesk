// Backup and restore of the business data as one JSON document. No "server-only" import, because the
// command-line scripts use it too, and the database client is passed in so each caller uses its own.
// Relative imports for the same reason (the scripts run outside Next.js).
import type { PrismaClient } from "../../generated/prisma/client";

/** Parents before children, so a restore never refers to a row that does not exist yet. */
export const TABLE_ORDER = [
  "Sku",
  "Scheme",
  "User",
  "Retailer",
  "RetailerPrice",
  "Order",
  "OrderLine",
  "OrderEvent",
  "Alias",
  "AiCapture",
  "CatalogueEvent",
  "ShopEvent",
  "StaffEvent",
  "BalanceImport",
  "TallySetting",
] as const;
export type TableName = (typeof TABLE_ORDER)[number];

export interface Backup {
  meta: { app: "RetailDesk"; format: 1; createdAt: string; includesSecrets: boolean; counts: Record<string, number> };
  tables: Record<string, Record<string, unknown>[]>;
}

type Delegate = { findMany: (args?: object) => Promise<Record<string, unknown>[]>; count: () => Promise<number> };

function delegates(db: PrismaClient): Record<TableName, Delegate> {
  return {
    Sku: db.sku,
    Scheme: db.scheme,
    User: db.user,
    Retailer: db.retailer,
    RetailerPrice: db.retailerPrice,
    Order: db.order,
    OrderLine: db.orderLine,
    OrderEvent: db.orderEvent,
    Alias: db.alias,
    AiCapture: db.aiCapture,
    CatalogueEvent: db.catalogueEvent,
    ShopEvent: db.shopEvent,
    StaffEvent: db.staffEvent,
    BalanceImport: db.balanceImport,
    TallySetting: db.tallySetting,
  } as unknown as Record<TableName, Delegate>;
}

/**
 * Reads every business table. Login codes, rate-limit counters and the error log are left out: they are
 * temporary. Password hashes are only included when asked for (a backup kept by the developer), never in
 * the file a desk user downloads.
 */
export async function dumpDatabase(db: PrismaClient, opts: { includeSecrets: boolean; now?: Date }): Promise<Backup> {
  const d = delegates(db);
  const tables: Backup["tables"] = {};
  const counts: Record<string, number> = {};
  for (const name of TABLE_ORDER) {
    let rows = await d[name].findMany();
    if (name === "User" && !opts.includeSecrets) rows = rows.map((r) => ({ ...r, passwordHash: null }));
    tables[name] = rows;
    counts[name] = rows.length;
  }
  return {
    meta: { app: "RetailDesk", format: 1, createdAt: (opts.now ?? new Date()).toISOString(), includesSecrets: opts.includeSecrets, counts },
    tables,
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const JSON_COLUMNS = new Set(["rows", "summary"]);

/** JSON turns dates into text; turn them back, except inside the JSON columns, which are stored as they were. */
export function reviveDates(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" && !JSON_COLUMNS.has(k) && ISO.test(v) ? new Date(v) : v;
  }
  return out;
}

export function checkBackup(data: unknown): Backup {
  const b = data as Backup;
  if (!b || b.meta?.app !== "RetailDesk" || b.meta.format !== 1 || typeof b.tables !== "object") {
    throw new Error("This is not a RetailDesk backup file.");
  }
  for (const name of TABLE_ORDER) if (!Array.isArray(b.tables[name])) throw new Error(`The backup is missing the ${name} table.`);
  return b;
}

const BATCH = 500;

/**
 * Loads a backup into an EMPTY database. It refuses if any business table already has rows, so it cannot
 * be pointed at a live database by mistake. The User and Retailer tables refer to each other, so users
 * go in first without their shop link, and the link is added once the shops exist.
 */
export async function restoreDatabase(db: PrismaClient, backup: Backup): Promise<Record<string, number>> {
  const d = delegates(db);
  for (const name of TABLE_ORDER) {
    const n = await d[name].count();
    if (n > 0) throw new Error(`The ${name} table already has ${n} rows. A restore only goes into an empty database.`);
  }

  const create = async (name: TableName, rows: Record<string, unknown>[]) => {
    const model = (name[0].toLowerCase() + name.slice(1)) as keyof PrismaClient;
    const delegate = db[model] as unknown as { createMany: (a: { data: object[] }) => Promise<unknown> };
    for (let i = 0; i < rows.length; i += BATCH) await delegate.createMany({ data: rows.slice(i, i + BATCH) });
  };

  const restored: Record<string, number> = {};
  const users = backup.tables.User.map(reviveDates);
  for (const name of TABLE_ORDER) {
    if (name === "User") {
      await create("User", users.map((u) => ({ ...u, retailerId: null })));
    } else if (name === "Retailer") {
      await create("Retailer", backup.tables.Retailer.map(reviveDates));
      for (const u of users.filter((x) => x.retailerId)) {
        await db.user.update({ where: { id: u.id as string }, data: { retailerId: u.retailerId as string } });
      }
    } else {
      await create(name, backup.tables[name].map(reviveDates));
    }
    restored[name] = backup.tables[name].length;
  }
  return restored;
}
