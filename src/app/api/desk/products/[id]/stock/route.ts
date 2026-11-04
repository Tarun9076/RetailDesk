import { getCurrentUser } from "@/lib/auth/dal";
import { StockBody } from "@/lib/catalogue-admin/schemas";
import { adjustStock } from "@/lib/catalogue-admin/service";
import { json, parseBody } from "@/lib/http";

/** Add stock (a delivery came in), remove stock (damage, a count), or set it to a counted figure. A reason is required. */
export async function POST(req: Request, ctx: RouteContext<"/api/desk/products/[id]/stock">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, StockBody);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const r = await adjustStock(id, parsed.data, user.name);
  if (r.ok) return json({ before: r.before, after: r.after });
  if (r.reason === "not_found") return json({ error: "not_found" }, 404);
  if (r.reason === "below_zero") return json({ error: "below_zero", available: r.available }, 409);
  return json({ error: "changed", current: r.current }, 409);
}
