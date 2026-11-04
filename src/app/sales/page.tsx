import { FieldApp } from "@/components/field/field-app";
import { requireSalesman } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";

/**
 * The salesman's app. This page carries no shop, price or person: it is only
 * the shell. Everything else is loaded into the phone by /api/sales/sync, so
 * the same shell can be kept by the service worker and opened with no signal.
 */
export default async function SalesPage() {
  await requireSalesman();
  const { lang, t } = await getDict();
  return (
    <FieldApp
      lang={lang}
      t={t.catalogue}
      tInstall={t.install}
      appName={t.common.appName}
      signOutLabel={t.common.signOut}
    />
  );
}
