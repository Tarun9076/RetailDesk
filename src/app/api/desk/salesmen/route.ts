import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { normalisePhone } from "@/lib/auth/phone";
import { isPhoneTaken } from "@/lib/auth/phone-taken";
import { db } from "@/lib/db";
import { json, parseBody } from "@/lib/http";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().min(10).max(20),
});

/** The desk adds a salesman. They can sign in at once with an SMS code on this number. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if ("error" in parsed) return parsed.error;

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return json({ error: "invalid_phone" }, 422);
  if (await isPhoneTaken(phone)) return json({ error: "phone_taken" }, 409);

  try {
    const created = await db.user.create({
      data: { role: "SALESMAN", name: parsed.data.name, phone },
      select: { id: true, name: true, phone: true },
    });
    return json(created, 201);
  } catch {
    // Two people adding the same number at the same moment.
    return json({ error: "phone_taken" }, 409);
  }
}
