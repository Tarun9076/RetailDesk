import { getCurrentUser } from "@/lib/auth/dal";
import { ProductBody } from "@/lib/catalogue-admin/schemas";
import { createProduct } from "@/lib/catalogue-admin/service";
import { json, parseBody } from "@/lib/http";

/** The desk adds a product to the catalogue. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, ProductBody);
  if ("error" in parsed) return parsed.error;

  const r = await createProduct(parsed.data, user.name);
  if (!r.ok) return json({ error: r.reason }, 409);
  return json({ id: r.id }, 201);
}
