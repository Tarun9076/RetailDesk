"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { StatusScreen, quietLink } from "@/components/status-screen";

/**
 * What every page shows when it breaks. The shop or desk header stays where it is (this sits inside the
 * layout), "Try again" asks the server for the page once more, and the short reference lets whoever
 * looks after the system find this exact failure in the log. The error's own message is never shown.
 */
export function RouteError({ error, retry, home = "/" }: { error: unknown; retry: () => void; home?: string }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <StatusScreen
      mark="!"
      title="Something went wrong"
      hint="This is on our side, not yours. Your cart and order are safe. Please try again."
      titleHi="कुछ गड़बड़ हो गई"
      hintHi="यह हमारी तरफ़ की गलती है। आपका कार्ट और ऑर्डर सुरक्षित हैं। कृपया फिर कोशिश करें।"
      reference={digest}
    >
      <Button type="button" onClick={() => retry()}>
        Try again · फिर कोशिश करें
      </Button>
      <Link href={home} className={quietLink}>
        Go to the start · शुरुआत पर जाएँ
      </Link>
    </StatusScreen>
  );
}
