import { CaptureView } from "@/components/retailer/capture-view";
import { requireRetailer } from "@/lib/auth/dal";
import { getDict } from "@/lib/i18n/server";

export default async function CapturePage() {
  await requireRetailer();
  const { t } = await getDict();
  return <CaptureView t={t.capture} />;
}
