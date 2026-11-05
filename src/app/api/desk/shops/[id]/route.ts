import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { ShopPatch } from "@/lib/shops/rules";
import { updateShop } from "@/lib/shops/service";

/** Edit a shop's details, credit limit, amount owed, Tally name, salesman, or switch it on or off. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/shops/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, ShopPatch);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const r = await updateShop(id, parsed.data, user.name);
  if (r.ok) return json({ ok: true, changed: r.changed });
  if (r.reason === "not_found") return json({ error: "not_found" }, 404);
  if (r.reason === "invalid_phone" || r.reason === "unknown_salesman") return json({ error: r.reason }, 422);
  return json({ error: r.reason }, 409);
}
