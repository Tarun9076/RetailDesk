import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/auth/dal";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { ChangePasswordForm } from "./change-password-form";

/**
 * Lives outside the desk layout on purpose: an account still on a temporary
 * password is allowed here and nowhere else in the desk.
 */
export default async function AccountPage(props: PageProps<"/desk/account">) {
  const user = await getSessionUser();
  if (!user || user.role !== "DESK") redirect("/desk/login");
  const { first } = await props.searchParams;
  const forced = user.mustChangePassword || first === "1";

  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold tracking-tight">{forced ? "Choose your password" : "Change your password"}</h1>
      <p className="mt-2 text-muted">
        {forced
          ? "You signed in with a temporary password. Choose your own to continue. Only you should know it."
          : "Signing in on other computers will be ended, so only this one stays signed in."}
      </p>
      <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} forced={user.mustChangePassword} />
      {!user.mustChangePassword && (
        <p className="mt-8 text-center text-sm">
          <Link href="/desk" className="inline-block min-h-11 py-3 text-muted underline-offset-4 hover:underline">
            Back to the desk
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
