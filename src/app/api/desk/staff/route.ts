import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { json, parseBody } from "@/lib/http";
import { addStaff } from "@/lib/staff/service";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
});

/** Add a desk colleague. The temporary password in the answer is shown once and never stored in readable form. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const r = await addStaff(parsed.data, user.name);
  if (!r.ok) return json({ error: r.reason }, 409);
  return json({ id: r.id, email: r.email, tempPassword: r.tempPassword }, 201);
}
