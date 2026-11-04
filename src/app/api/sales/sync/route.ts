import { getCurrentUser } from "@/lib/auth/dal";
import { loadFieldSnapshot } from "@/lib/field/data";
import { json } from "@/lib/http";

/** The salesman's offline package. Per user, never cached by the browser or the service worker. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SALESMAN") return json({ error: "Unauthorized" }, 401);
  return json(await loadFieldSnapshot(user.id));
}
