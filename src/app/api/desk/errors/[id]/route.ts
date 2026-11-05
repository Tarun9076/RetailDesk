import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

const Body = z.object({ resolved: z.boolean() });

/** Mark a logged problem as dealt with. If it happens again it comes back as new and alerts again. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/errors/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const r = await db.errorLog.updateMany({ where: { id }, data: { resolved: parsed.data.resolved } });
  return r.count === 1 ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
