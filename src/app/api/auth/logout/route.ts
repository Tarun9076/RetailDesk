import { destroySession } from "@/lib/auth/session";
import { isSameOrigin, json } from "@/lib/http";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  await destroySession();
  return json({ ok: true });
}
