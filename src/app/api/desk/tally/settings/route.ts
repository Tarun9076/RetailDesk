import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { json, parseBody } from "@/lib/http";
import { templateProblem } from "@/lib/tally/masters";
import { SETTING_KEYS } from "@/lib/tally/settings";

const text = z.string().trim().max(120);
const Body = z.object({
  company: text,
  salesLedger: text,
  unit: text,
  cgstLedger: text,
  sgstLedger: text,
  voucherType: text,
});

/** Save the names used in the Tally file. A blank box means "use the standard name". */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;

  for (const key of ["cgstLedger", "sgstLedger"] as const) {
    const problem = templateProblem(d[key]);
    if (problem) return json({ error: "invalid", field: key, message: problem }, 422);
  }

  await db.$transaction(
    SETTING_KEYS.map((key) =>
      d[key]
        ? db.tallySetting.upsert({ where: { key }, create: { key, value: d[key] }, update: { value: d[key] } })
        : db.tallySetting.deleteMany({ where: { key } }),
    ),
  );
  return json({ ok: true });
}
