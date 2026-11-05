"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { secondaryBtn } from "@/components/desk/catalogue/styles";

/** Sends a deliberate failing request, then reloads the page so the error appears in the list. */
export function TestErrorButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={state === "busy"}
        className={secondaryBtn}
        onClick={async () => {
          setState("busy");
          await fetch("/api/desk/system/test-error", { method: "POST" }).catch(() => undefined);
          // Give the server a moment to write the log before reloading the list.
          await new Promise((r) => setTimeout(r, 1500));
          setState("sent");
          router.refresh();
        }}
      >
        {state === "busy" ? "Sending…" : "Send a test error"}
      </button>
      {state === "sent" && (
        <span role="status" className="text-sm text-muted">
          Sent. It should appear below{" "}
          and in your alert channel if one is set up.
        </span>
      )}
    </div>
  );
}

export function ResolveButton({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={secondaryBtn}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/desk/errors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved: !resolved }),
        }).catch(() => undefined);
        setBusy(false);
        router.refresh();
      }}
    >
      {resolved ? "Reopen" : "Mark as dealt with"}
    </button>
  );
}
