import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { placeOrder } from "@/lib/orders/place";

const Body = z.object({
  idempotencyKey: z.uuid(),
  captureId: z.string().min(1).max(40).optional(),
  note: z.string().trim().max(200).optional(),
  lines: z
    .array(
      z.object({
        skuId: z.string().min(1).max(40),
        qtyCases: z.number().int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(60),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  // The retailer comes from the session, never from the request body.
  if (!user || user.role !== "RETAILER" || !user.retailerId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const result = await placeOrder({
    retailerId: user.retailerId,
    lines: parsed.data.lines,
    note: parsed.data.note,
    idempotencyKey: parsed.data.idempotencyKey,
    captureId: parsed.data.captureId,
  });

  if (!result.ok) {
    if (result.reason === "stock") return json({ error: "stock", issues: result.issues }, 409);
    return json({ error: result.reason }, 422);
  }
  return json(
    { orderId: result.orderId, number: result.number, status: result.status },
    result.duplicate ? 200 : 201,
  );
}
