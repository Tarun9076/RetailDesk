import { z } from "zod";
import { getCurrentUser, salesmanOwnsShop } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { placeOrder } from "@/lib/orders/place";

const Body = z.object({
  idempotencyKey: z.uuid(),
  captureId: z.string().min(1).max(40).optional(),
  note: z.string().trim().max(200).optional(),
  /** Salesmen only: the shop they are ordering for. Ignored for a shopkeeper. */
  retailerId: z.string().min(1).max(40).optional(),
  /** Salesmen only: when the phone took the order, if it was offline. */
  capturedAt: z.iso.datetime().optional(),
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

/** A phone's clock can be wrong. Never in the future, and never older than the 30 days an offline phone could plausibly hold an order. */
function trustedCapturedAt(iso: string | undefined, now = new Date()): Date | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return undefined;
  if (t > now.getTime()) return now;
  if (t < now.getTime() - 30 * 86_400_000) return undefined;
  return new Date(t);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  let retailerId: string;
  let placedById: string | undefined;
  let capturedAt: Date | undefined;

  if (user.role === "RETAILER" && user.retailerId) {
    // A shopkeeper's shop comes from the session, never from the request body.
    retailerId = user.retailerId;
  } else if (user.role === "SALESMAN") {
    if (!parsed.data.retailerId) return json({ error: "shop_required" }, 422);
    if (!(await salesmanOwnsShop(user.id, parsed.data.retailerId))) {
      return json({ error: "not_your_shop" }, 403);
    }
    retailerId = parsed.data.retailerId;
    placedById = user.id;
    capturedAt = trustedCapturedAt(parsed.data.capturedAt);
  } else {
    return json({ error: "Unauthorized" }, 401);
  }

  const result = await placeOrder({
    retailerId,
    lines: parsed.data.lines,
    note: parsed.data.note,
    idempotencyKey: parsed.data.idempotencyKey,
    captureId: user.role === "RETAILER" ? parsed.data.captureId : undefined,
    placedById,
    capturedAt,
  });

  if (!result.ok) {
    if (result.reason === "stock") return json({ error: "stock", issues: result.issues }, 409);
    return json({ error: result.reason }, 422);
  }
  return json(
    {
      orderId: result.orderId,
      number: result.number,
      status: result.status,
      totalPaise: result.totalPaise,
      lines: result.lines,
    },
    result.duplicate ? 200 : 201,
  );
}
