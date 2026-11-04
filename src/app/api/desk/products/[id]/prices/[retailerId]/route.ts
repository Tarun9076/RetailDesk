import { getCurrentUser } from "@/lib/auth/dal";
import { ShopPriceBody } from "@/lib/catalogue-admin/schemas";
import { removeShopPrice, setShopPrice } from "@/lib/catalogue-admin/service";
import { isSameOrigin, json, parseBody } from "@/lib/http";

/** Give one shop its own price for this product (per piece, GST extra). */
export async function PUT(req: Request, ctx: RouteContext<"/api/desk/products/[id]/prices/[retailerId]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, ShopPriceBody);
  if ("error" in parsed) return parsed.error;

  const { id, retailerId } = await ctx.params;
  const r = await setShopPrice(id, retailerId, parsed.data.pricePaise, user.name);
  return r.ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
}

/** Take the shop back to the dealer price. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/desk/products/[id]/prices/[retailerId]">) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const { id, retailerId } = await ctx.params;
  const r = await removeShopPrice(id, retailerId, user.name);
  return r.ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
