import { gzipSync } from "node:zlib";
import { getCurrentUser } from "@/lib/auth/dal";
import { dumpDatabase } from "@/lib/backup/dump";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * Downloads all business data (shops, products, schemes, prices, orders and their history) as one compressed
 * file. Password hashes are NOT in it. For a full backup that can restore logins too, run `npm run db:backup`.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const backup = await dumpDatabase(db, { includeSecrets: false });
  const total = Object.values(backup.meta.counts).reduce((a, b) => a + b, 0);
  await db.staffEvent.create({
    data: { userId: user.id, kind: "BACKUP_DOWNLOADED", summary: `Downloaded a backup (${total} records)`, byName: user.name },
  });

  const day = backup.meta.createdAt.slice(0, 10);
  const body = gzipSync(JSON.stringify(backup));
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="retaildesk-backup-${day}.json.gz"`,
      "Cache-Control": "no-store",
    },
  });
}
