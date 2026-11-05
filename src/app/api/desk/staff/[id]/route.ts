import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { setStaffActive } from "@/lib/staff/service";

const Body = z.object({ active: z.boolean() });

/** Switch a colleague off (they leave) or back on. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/desk/staff/[id]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const r = await setStaffActive(id, parsed.data.active, { id: user.id, name: user.name });
  if (r.ok) return json({ ok: true });
  if (r.reason === "not_found") return json({ error: "not_found" }, 404);
  return json({ error: r.reason }, 409);
}
