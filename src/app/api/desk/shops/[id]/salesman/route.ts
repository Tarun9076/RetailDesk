import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

const Body = z.object({ salesmanId: z.string().min(1).max(40).nullable() });

/** The desk decides which salesman visits which shop. null un-assigns it. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/shops/[id]/salesman">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const { salesmanId } = parsed.data;
  if (salesmanId) {
    const salesman = await db.user.findFirst({ where: { id: salesmanId, role: "SALESMAN" }, select: { id: true } });
    if (!salesman) return json({ error: "unknown_salesman" }, 422);
  }
  const res = await db.retailer.updateMany({ where: { id }, data: { salesmanId } });
  if (res.count !== 1) return json({ error: "not_found" }, 404);
  return json({ ok: true });
}
