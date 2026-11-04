import { FieldApp } from "@/components/field/field-app";
import { requireSalesman } from "@/lib/auth/dal";
import { getLang } from "@/lib/i18n/server";

/**
 * The salesman's app. This page carries no shop, price or person: it is only
 * the shell. Everything else is loaded into the phone by /api/sales/sync, so
 * the same shell can be kept by the service worker and opened with no signal.
 * It only passes the language the server saw; the app then follows the phone's own language setting.
 */
export default async function SalesPage() {
  await requireSalesman();
  return <FieldApp initialLang={await getLang()} />;
}
