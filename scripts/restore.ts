/**
 * Loads a backup file into an EMPTY database.
 *
 *   RESTORE_DATABASE_URL=postgresql://... npm run db:restore -- backups/retaildesk-20261105-1030.json.gz
 *
 * Create the empty database first and run `npm run db:deploy` against it so the tables exist. This script
 * uses its own variable, RESTORE_DATABASE_URL, and not DATABASE_URL, so it cannot touch the live
 * database by accident. It also refuses to run if any table already has rows.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { checkBackup, restoreDatabase } from "../src/lib/backup/dump";

async function main() {
  const file = process.argv[2];
  const url = process.env.RESTORE_DATABASE_URL;
  if (!file) throw new Error("Give the backup file: npm run db:restore -- backups/<file>.json.gz");
  if (!url) throw new Error("Set RESTORE_DATABASE_URL to the EMPTY database to restore into.");

  const raw = readFileSync(file);
  const text = (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8");
  const backup = checkBackup(JSON.parse(text));

  // RESTORE_SCHEMA is for practising a restore inside the same database server without touching live data.
  const schema = process.env.RESTORE_SCHEMA;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, schema ? { schema } : undefined) });
  try {
    console.log(`Backup made ${backup.meta.createdAt}${backup.meta.includesSecrets ? "" : " (without password hashes)"}`);
    const restored = await restoreDatabase(db, backup);
    console.log("Restored:", Object.entries(restored).map(([k, v]) => `${k}: ${v}`).join("  "));
    if (!backup.meta.includesSecrets) {
      console.log("Desk staff have no passwords in this backup. Set one with: npm run desk:reset");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
