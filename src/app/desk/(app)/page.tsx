import { requireDesk } from "@/lib/auth/dal";
import { fmt } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";

export default async function DeskHome() {
  const user = await requireDesk();
  const { t } = await getDict();
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">{t.desk.title}</h1>
      <p className="mt-2 text-muted">{fmt(t.home.deskWelcome, { name: user.name })}</p>
    </section>
  );
}
