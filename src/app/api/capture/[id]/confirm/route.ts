import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { confirmCapture } from "@/lib/capture/service";
import { json, parseBody } from "@/lib/http";

const Body = z.object({
  lines: z
    .array(
      z.object({
        index: z.number().int().min(0).max(100),
        skuId: z.string().min(1).max(40),
        qtyCases: z.number().int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request, ctx: RouteContext<"/api/capture/[id]/confirm">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "RETAILER" || !user.retailerId) return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const { id } = await ctx.params;
  const result = await confirmCapture(user.retailerId, id, parsed.data.lines);
  if (!result.ok) return json({ error: result.reason }, result.reason === "not_found" ? 404 : 422);
  return json({ ok: true, learned: result.learned });
}
