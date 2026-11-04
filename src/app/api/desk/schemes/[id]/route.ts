import { getCurrentUser } from "@/lib/auth/dal";
import { SchemePatch } from "@/lib/catalogue-admin/schemas";
import { patchScheme, removeScheme } from "@/lib/catalogue-admin/service";
import { isSameOrigin, json, parseBody } from "@/lib/http";

/** Switch a scheme on or off, or change its dates. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/schemes/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, SchemePatch);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const r = await patchScheme(id, parsed.data, user.name);
  if (r.ok) return json({ ok: true });
  if (r.reason === "not_found") return json({ error: "not_found" }, 404);
  return json({ error: "invalid", message: r.message }, 422);
}

/** Remove a scheme. Past orders keep the scheme name they were priced with. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/desk/schemes/[id]">) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const { id } = await ctx.params;
  const r = await removeScheme(id, user.name);
  return r.ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
