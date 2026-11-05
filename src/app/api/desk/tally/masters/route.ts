import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { mastersToCsv, requiredMasters } from "@/lib/tally/masters";
import { getTallyConfig } from "@/lib/tally/settings";

/** The set-up checklist as a CSV: every ledger, stock item and unit the Tally file refers to. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const [cfg, shops, skus] = await Promise.all([
    getTallyConfig(),
    db.retailer.findMany({ where: { active: true }, select: { shopName: true, tallyLedgerName: true }, orderBy: { shopName: "asc" } }),
    db.sku.findMany({ where: { active: true }, select: { name: true, gstRateBp: true }, orderBy: { name: "asc" } }),
  ]);
  const csv = mastersToCsv(
    requiredMasters(cfg, { gstRatesBp: skus.map((s) => s.gstRateBp), shops, productNames: skus.map((s) => s.name) }),
  );
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tally-setup-checklist.csv"',
      "Cache-Control": "no-store",
    },
  });
}
