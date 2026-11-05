import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isSessionRevoked } from "./session-rules";
import { readSession } from "./session";

/**
 * The signed-in account, checked against the database on every request, so a
 * switched-off person, a switched-off shop, or a password change takes effect
 * at once (the cookie alone is never trusted). Also used by the one screen
 * that desk staff with a temporary password are allowed to reach.
 */
export const getSessionUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { retailer: true },
  });
  if (!user || !user.active || user.role !== session.role) return null;
  // A shop that has been switched off loses access, even to a cookie that is still valid.
  if (user.role === "RETAILER" && !user.retailer?.active) return null;
  if (isSessionRevoked(user.sessionsValidFrom, session.issuedAtMs)) return null;
  return user;
});

/**
 * The signed-in user for everything except changing a temporary password.
 * A desk account that still has a temporary password gets nothing until it
 * has chosen its own, so it cannot be used for anything by whoever was told it.
 */
export const getCurrentUser = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role === "DESK" && user.mustChangePassword) return null;
  return user;
});

export async function requireRetailer() {
  const user = await getCurrentUser();
  if (!user || user.role !== "RETAILER" || !user.retailer) redirect("/login");
  return { user, retailer: user.retailer };
}

export async function requireSalesman() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SALESMAN") redirect("/sales/login");
  return user;
}

/**
 * A salesman may see and order for a shop only when the desk has assigned it
 * to them and the shop is switched on. Everything that touches a shop on a
 * salesman's behalf goes through here.
 */
export async function salesmanOwnsShop(salesmanId: string, retailerId: string) {
  const shop = await db.retailer.findFirst({
    where: { id: retailerId, salesmanId, active: true },
    select: { id: true },
  });
  return shop !== null;
}

export async function requireDesk() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") redirect("/desk/login");
  return user;
}
