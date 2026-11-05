import { getCurrentUser } from "@/lib/auth/dal";
import { applyBalanceImport, discardBalanceImport } from "@/lib/balances/service";
import { isSameOrigin, json } from "@/lib/http";

/** Apply a previewed balance import. */
export async function POST(req: Request, ctx: RouteContext<"/api/desk/balances/[id]">) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const { id } = await ctx.params;
  const r = await applyBalanceImport(id, user.name);
  if (r.ok) return json({ updated: r.updated, skippedChanged: r.skippedChanged, unchanged: r.unchanged });
  if (r.reason === "not_found") return json({ error: "not_found" }, 404);
  return json({ error: r.reason }, 409);
}

/** Throw a preview away. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/desk/balances/[id]">) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const { id } = await ctx.params;
  return (await discardBalanceImport(id)) ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
