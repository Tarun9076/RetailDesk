"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** A plain dropdown: pick the salesman who visits this shop. Saves as soon as it changes. */
export function AssignSalesman({
  shopId,
  shopName,
  current,
  salesmen,
}: {
  shopId: string;
  shopName: string;
  current: string | null;
  salesmen: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function change(next: string) {
    const before = value;
    setValue(next);
    setState("saving");
    try {
      const res = await fetch(`/api/desk/shops/${shopId}/salesman`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesmanId: next || null }),
      });
      if (!res.ok) throw new Error("failed");
      setState("saved");
      router.refresh();
    } catch {
      setValue(before);
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={state === "saving"}
        aria-label={`Salesman for ${shopName}`}
        onChange={(e) => void change(e.target.value)}
        className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm focus:border-accent"
      >
        <option value="">Not assigned</option>
        {salesmen.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <span role="status" className="w-14 text-xs text-muted">
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Failed" : ""}
      </span>
    </div>
  );
}
