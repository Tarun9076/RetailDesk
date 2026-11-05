import { Download } from "lucide-react";
import { ResolveButton, TestErrorButton } from "@/components/desk/system-actions";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { webhookAllowed } from "@/lib/monitoring/rules";

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number }> {
  const t = performance.now();
  try {
    return { value: await fn(), ms: Math.round(performance.now() - t) };
  } catch {
    return { value: null, ms: Math.round(performance.now() - t) };
  }
}

export default async function SystemPage() {
  await requireDesk();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000);

  const [ping, errors, openErrors24, orders24, lastBackup] = await Promise.all([
    timed(() => db.$queryRaw`select 1`),
    db.errorLog.findMany({ orderBy: [{ resolved: "asc" }, { lastSeenAt: "desc" }], take: 40 }),
    db.errorLog.count({ where: { resolved: false, lastSeenAt: { gte: dayAgo } } }),
    db.order.count({ where: { createdAt: { gte: dayAgo } } }),
    db.staffEvent.findFirst({ where: { kind: "BACKUP_DOWNLOADED" }, orderBy: { createdAt: "desc" } }),
  ]);
  const dbOk = ping.value !== null;
  const alertOn = webhookAllowed(process.env.ALERT_WEBHOOK_URL);
  const backupAgeDays = lastBackup ? Math.floor((now.getTime() - lastBackup.createdAt.getTime()) / 86_400_000) : null;

  const tile = (label: string, value: string, tone = "") => (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">System</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">Is the app healthy, what went wrong lately, and how to keep a copy of your data.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile("Database", dbOk ? `Reachable · ${ping.ms} ms` : "Not reachable", dbOk ? "text-accent" : "text-danger")}
        {tile("Problems in the last 24 hours", String(openErrors24), openErrors24 > 0 ? "text-danger" : "text-accent")}
        {tile("Orders in the last 24 hours", String(orders24))}
        {tile("Alerts to chat", alertOn ? "Switched on" : "Switched off", alertOn ? "text-accent" : "text-amber-700")}
      </div>

      <section aria-labelledby="errors" className="mt-6 rounded-2xl border border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="errors" className="text-lg font-semibold">Problems</h2>
          <TestErrorButton />
        </div>
        <p className="mt-1 text-sm text-muted">
          Each kind of problem is listed once with how many times it happened. Names, phone numbers and emails are removed.
          {!alertOn && " To be told in chat when something fails, set ALERT_WEBHOOK_URL (see the deployment notes)."}
        </p>
        {errors.length === 0 ? (
          <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong">No problems recorded. That is what you want.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {errors.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={`font-medium ${e.resolved ? "text-muted line-through" : ""}`}>{e.message}</p>
                  <p className="text-xs text-muted">
                    {[e.method, e.route].filter(Boolean).join(" ") || "No route"} · {e.count} {e.count === 1 ? "time" : "times"} · last {formatDateTime(e.lastSeenAt)}
                    {e.digest ? ` · ref ${e.digest}` : ""}
                  </p>
                  {e.detail && !e.resolved && (
                    <details className="mt-1 text-xs text-muted">
                      <summary className="cursor-pointer">Technical detail</summary>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-2">{e.detail}</pre>
                    </details>
                  )}
                </div>
                <ResolveButton id={e.id} resolved={e.resolved} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="backup" className="mt-6 rounded-2xl border border-line p-5">
        <h2 id="backup" className="text-lg font-semibold">Backups</h2>
        <p className="mt-1 text-sm text-muted">
          {lastBackup
            ? `Last backup downloaded ${formatDateTime(lastBackup.createdAt)} by ${lastBackup.byName}${backupAgeDays !== null && backupAgeDays >= 7 ? ` (${backupAgeDays} days ago: time for a new one)` : ""}.`
            : "No backup has been downloaded from here yet."}
        </p>
        <a
          href="/api/desk/backup"
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong"
        >
          <Download size={16} aria-hidden /> Download a backup now
        </a>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>The file holds all shops, products, prices, schemes and orders with their history, compressed. Keep it somewhere safe and private: it contains customer phone numbers.</li>
          <li>It does <strong>not</strong> hold passwords. For a full backup that can also restore sign-ins, whoever manages the server runs <code>npm run db:backup</code>.</li>
          <li>Your database host (Supabase) may also keep its own automatic backups, depending on the plan. Check <em>Database, then Backups</em> in its dashboard. Do not rely on that alone.</li>
          <li>Restoring goes only into an empty database, with <code>npm run db:restore</code>. See the deployment notes.</li>
        </ul>
      </section>

      <section aria-labelledby="uptime" className="mt-6 rounded-2xl border border-line p-5 text-sm">
        <h2 id="uptime" className="text-lg font-semibold">Checking from outside</h2>
        <p className="mt-1 text-muted">
          Point a free uptime monitor (for example UptimeRobot) at <code>/api/health</code>. It answers 200 when the app can
          reach its database and 503 when it cannot, and says nothing about your shops or orders.
        </p>
      </section>
    </div>
  );
}
