import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { applyDeskAction } from "@/lib/orders/desk";

const Body = z
  .object({
    action: z.enum(["CONFIRM", "RELEASE", "CANCEL"]),
    note: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.action !== "CANCEL" || (b.note?.length ?? 0) >= 3, {
    message: "A reason is required to cancel",
    path: ["note"],
  });

export async function POST(req: Request, ctx: RouteContext<"/api/desk/orders/[id]/action">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const result = await applyDeskAction({
    orderId: id,
    action: parsed.data.action,
    byName: user.name,
    note: parsed.data.note,
  });

  if (!result.ok) {
    return json({ error: result.reason }, result.reason === "not_found" ? 404 : 409);
  }
  return json({ ok: true, status: result.status });
}
