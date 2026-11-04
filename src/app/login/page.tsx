import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";
import { OtpLoginForm } from "./otp-login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "DESK" ? "/desk" : user.role === "SALESMAN" ? "/sales" : "/catalogue");

  const { t } = await getDict();
  return (
    <AuthShell>
      <OtpLoginForm t={t.login} />
      <p className="mt-10 flex flex-col items-center text-center text-sm">
        <Link href="/sales/login" className="inline-block min-h-11 py-3 text-muted underline-offset-4 hover:underline">
          {t.login.salesman}
        </Link>
        <Link href="/desk/login" className="inline-block min-h-11 py-3 text-muted underline-offset-4 hover:underline">
          {t.login.staff}
        </Link>
      </p>
    </AuthShell>
  );
}
