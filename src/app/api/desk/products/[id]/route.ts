import { getCurrentUser } from "@/lib/auth/dal";
import { ProductPatch } from "@/lib/catalogue-admin/schemas";
import { updateProduct } from "@/lib/catalogue-admin/service";
import { json, parseBody } from "@/lib/http";

/** Edit a product's details, price, GST rate, or take it off sale. Stock and schemes have their own routes. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/products/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, ProductPatch);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const r = await updateProduct(id, parsed.data, user.name);
  if (!r.ok) return json({ error: r.reason }, 404);
  return json({ ok: true, changed: r.changed });
}
