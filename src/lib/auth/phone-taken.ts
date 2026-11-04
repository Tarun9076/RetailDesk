import "server-only";
import { db } from "@/lib/db";

/**
 * One phone number can belong to one account only, whether a shop or a
 * salesman. Otherwise the sign-in screen could not tell which app to open.
 */
export async function isPhoneTaken(phone: string): Promise<boolean> {
  const [shop, salesman] = await Promise.all([
    db.retailer.findUnique({ where: { phone }, select: { id: true } }),
    db.user.findUnique({ where: { phone }, select: { id: true } }),
  ]);
  return shop !== null || salesman !== null;
}
