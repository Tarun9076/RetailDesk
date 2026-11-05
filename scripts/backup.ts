/**
 * Saves every business table to one compressed file you can keep anywhere safe.
 *
 *   npm run db:backup
 *
 * The file includes the desk staff's password hashes (so a restore can sign people in again), which
 * means it must be stored like a password: not in the repository, not in chat, and not on a shared drive.
 * The "backups" folder is ignored by git. Restore with scripts/restore.ts into an empty database.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { dumpDatabase } from "../src/lib/backup/dump";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DIRECT_URL) first.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const backup = await dumpDatabase(db, { includeSecrets: true });
    const stamp = backup.meta.createdAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "").replace("T", "-").slice(0, 13);
    const dir = process.env.BACKUP_DIR ?? "backups";
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `retaildesk-${stamp}.json.gz`);
    writeFileSync(file, gzipSync(JSON.stringify(backup)));
    console.log(`Saved ${file}`);
    console.log(Object.entries(backup.meta.counts).map(([k, v]) => `${k}: ${v}`).join("  "));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
