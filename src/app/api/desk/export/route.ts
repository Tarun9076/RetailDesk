import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { exportOrders } from "@/lib/orders/export";

const Body = z.object({ orderIds: z.array(z.string().min(1).max(40)).min(1).max(300) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const result = await exportOrders(parsed.data.orderIds, user.name);
  if (!result.ok) return json({ error: result.reason }, 409);

  // Indian time for the file name, so it matches the voucher dates.
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  })
    .format(new Date())
    .replace(/[-: ]/g, "");

  return new Response(result.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="tally-sales-${stamp}.xml"`,
      "Cache-Control": "no-store",
      "X-Exported-Count": String(result.count),
      "X-Newly-Exported": String(result.newlyExported),
    },
  });
}
