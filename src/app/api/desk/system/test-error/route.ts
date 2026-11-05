import { getCurrentUser } from "@/lib/auth/dal";
import { isSameOrigin, json } from "@/lib/http";

/**
 * Fails on purpose, so the desk can prove that an error reaches the log and the alert channel.
 * It does nothing else and touches no data.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);
  throw new Error("Test error from the System page (on purpose, nothing is wrong)");
}
