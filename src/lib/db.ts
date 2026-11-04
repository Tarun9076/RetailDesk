import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Several people changing the same product (or ordering the same stock) at the same moment
    // queue up on one row. Waiting a few seconds for a turn is better than failing with an error.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
}

/** One client per server process; reused across hot reloads in dev. */
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
