import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";
import { DeskLoginForm } from "./desk-login-form";

export default async function DeskLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "DESK" ? "/desk" : "/catalogue");

  const { t } = await getDict();
  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold tracking-tight">{t.desk.title}</h1>
      <p className="mb-6 mt-2 text-muted">{t.desk.subtitle}</p>
      <DeskLoginForm t={t.desk} />
      <p className="mt-10 text-center text-sm">
        <Link href="/login" className="inline-block min-h-11 py-3 text-muted underline-offset-4 hover:underline">
          {t.desk.retailer}
        </Link>
      </p>
    </AuthShell>
  );
}
