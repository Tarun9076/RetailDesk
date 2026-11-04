import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

const Body = z.object({ active: z.boolean() });

/**
 * Switch a salesman off (they left) or back on. Off means they cannot sign in,
 * a login they already have stops working on its next request, and their shops
 * go back to "not assigned". Nothing is deleted: orders they took keep their name.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/salesmen/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const result = await db.$transaction(async (tx) => {
    const res = await tx.user.updateMany({ where: { id, role: "SALESMAN" }, data: { active: parsed.data.active } });
    if (res.count !== 1) return null;
    const freed = parsed.data.active ? 0 : (await tx.retailer.updateMany({ where: { salesmanId: id }, data: { salesmanId: null } })).count;
    return { freed };
  });
  if (!result) return json({ error: "not_found" }, 404);
  return json({ ok: true, shopsUnassigned: result.freed });
}
