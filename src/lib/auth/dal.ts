import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "./session";

/**
 * The signed-in user, re-checked against the database on every request so a
 * deleted or changed account loses access immediately (the cookie alone is not trusted).
 */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { retailer: true },
  });
  if (!user || user.role !== session.role) return null;
  return user;
});

export async function requireRetailer() {
  const user = await getCurrentUser();
  if (!user || user.role !== "RETAILER" || !user.retailer) redirect("/login");
  return { user, retailer: user.retailer };
}

export async function requireSalesman() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SALESMAN") redirect("/login");
  return user;
}

/**
 * A salesman may see and order for a shop only when the desk has assigned it
 * to them. Everything that touches a shop on a salesman's behalf goes through here.
 */
export async function salesmanOwnsShop(salesmanId: string, retailerId: string) {
  const shop = await db.retailer.findFirst({
    where: { id: retailerId, salesmanId },
    select: { id: true },
  });
  return shop !== null;
}

export async function requireDesk() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") redirect("/desk/login");
  return user;
}
