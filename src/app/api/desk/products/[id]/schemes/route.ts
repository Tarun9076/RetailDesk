import { getCurrentUser } from "@/lib/auth/dal";
import { SchemeBody } from "@/lib/catalogue-admin/schemas";
import { addScheme } from "@/lib/catalogue-admin/service";
import { json, parseBody } from "@/lib/http";

/** Add a scheme to a product: buy N get M free, or X% off at N or more cases. */
export async function POST(req: Request, ctx: RouteContext<"/api/desk/products/[id]/schemes">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, SchemeBody);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const r = await addScheme(id, parsed.data, user.name);
  if (r.ok) return json({ id: r.id }, 201);
  if (r.reason === "not_found") return json({ error: "not_found" }, 404);
  if (r.reason === "duplicate") return json({ error: "duplicate" }, 409);
  return json({ error: "invalid", message: r.message }, 422);
}
