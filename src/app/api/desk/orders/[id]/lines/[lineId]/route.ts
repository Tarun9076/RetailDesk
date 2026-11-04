import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { changeLineProduct } from "@/lib/orders/revise";

const Body = z.object({ skuId: z.string().min(1).max(40) });

const STATUS = { not_found: 404, not_allowed: 409, same: 422, bad_sku: 422, stock: 409 } as const;

export async function POST(req: Request, ctx: RouteContext<"/api/desk/orders/[id]/lines/[lineId]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const { id, lineId } = await ctx.params;
  const result = await changeLineProduct({
    orderId: id,
    lineId,
    newSkuId: parsed.data.skuId,
    byName: user.name,
  });
  if (!result.ok) return json({ error: result.reason }, STATUS[result.reason]);
  return json({ ok: true, learned: result.learned, status: result.status });
}
