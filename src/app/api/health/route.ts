import { db } from "@/lib/db";

/**
 * For an uptime monitor (UptimeRobot, Better Stack, a cron ping): 200 when the app can reach its
 * database, 503 when it cannot. It says nothing about shops, orders or people.
 */
export async function GET() {
  const started = performance.now();
  let dbOk = false;
  try {
    await db.$queryRaw`select 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return Response.json(
    { status: dbOk ? "ok" : "down", database: dbOk ? "ok" : "unreachable", latencyMs: Math.round(performance.now() - started) },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export const HEAD = GET;
