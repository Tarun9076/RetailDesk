import { getCurrentUser } from "@/lib/auth/dal";
import { isSameOrigin, json } from "@/lib/http";
import { resetStaffPassword } from "@/lib/staff/service";

/** Issue a colleague a new temporary password (for a forgotten one). Shown once; they must choose their own at next sign-in. */
export async function POST(req: Request, ctx: RouteContext<"/api/desk/staff/[id]/reset">) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const { id } = await ctx.params;
  const r = await resetStaffPassword(id, user.name);
  if (!r.ok) return json({ error: r.reason }, 404);
  return json({ email: r.email, tempPassword: r.tempPassword });
}
