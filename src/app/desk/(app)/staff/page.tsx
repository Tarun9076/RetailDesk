import Link from "next/link";
import { StaffManager, type StaffRow } from "@/components/desk/staff-manager";
import { requireDesk } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function StaffPage() {
  const me = await requireDesk();
  const [users, events] = await Promise.all([
    db.user.findMany({
      where: { role: "DESK" },
      select: { id: true, name: true, email: true, active: true, mustChangePassword: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.staffEvent.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const lastBy = new Map<string, string>();
  for (const e of events) if (!lastBy.has(e.userId)) lastBy.set(e.userId, `${e.summary} · ${formatDateTime(e.createdAt)} · by ${e.byName}`);

  const rows: StaffRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email ?? "",
    active: u.active,
    mustChange: u.mustChangePassword,
    isMe: u.id === me.id,
    lastEvent: lastBy.get(u.id) ?? null,
  }));
  const names = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Desk staff</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Everyone who can sign in to the order desk. Add a colleague, reset a forgotten password, or switch someone off
            when they leave: they are signed out at once.
          </p>
        </div>
        <Link href="/desk/account" className="flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface">
          Change my password
        </Link>
      </div>

      <div className="mt-6 max-w-4xl">
        <StaffManager staff={rows} />
      </div>

      <section aria-labelledby="staff-history" className="mt-8 max-w-4xl rounded-2xl border border-line p-5">
        <h2 id="staff-history" className="text-lg font-semibold">History</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:gap-4">
                <span className="w-32 shrink-0 text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                <span className="w-40 shrink-0 font-medium">{names.get(e.userId) ?? "Former account"}</span>
                <span className="min-w-0 flex-1">{e.summary}</span>
                <span className="shrink-0 text-xs text-muted">{e.byName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
