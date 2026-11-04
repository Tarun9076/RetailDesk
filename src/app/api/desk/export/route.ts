import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { exportOrders } from "@/lib/orders/export";

const Body = z.object({
  orderIds: z.array(z.string().min(1).max(40)).min(1).max(300),
  format: z.enum(["xlsx", "xml"]).default("xlsx"),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const result = await exportOrders(parsed.data.orderIds, user.name, parsed.data.format);
  if (!result.ok) return json({ error: result.reason }, 409);

  // Indian time for the file name, so it matches the order dates inside.
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  })
    .format(new Date())
    .replace(/[-: ]/g, "");

  const name = result.extension === "xlsx" ? `sales-register-${stamp}.xlsx` : `tally-sales-${stamp}.xml`;
  return new Response(typeof result.body === "string" ? result.body : new Uint8Array(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Exported-Count": String(result.count),
      "X-Newly-Exported": String(result.newlyExported),
    },
  });
}
