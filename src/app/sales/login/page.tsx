import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";
import { OtpLoginForm } from "@/app/login/otp-login-form";

/** Salesmen sign in here. It is the same SMS-code flow as shops, on its own labelled page. */
export default async function SalesLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "DESK" ? "/desk" : user.role === "SALESMAN" ? "/sales" : "/catalogue");

  const { t } = await getDict();
  return (
    <AuthShell>
      <OtpLoginForm t={t.login} title={t.login.salesmanTitle} subtitle={t.login.salesmanSubtitle} />
      <p className="mt-10 text-center text-sm">
        <Link href="/login" className="inline-block min-h-11 py-3 text-muted underline-offset-4 hover:underline">
          {t.login.shopLink}
        </Link>
      </p>
    </AuthShell>
  );
}
