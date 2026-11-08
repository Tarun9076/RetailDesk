"use client";

import { RouteError } from "@/components/route-error";

// Inside the shop layout, so the shop's header and tabs stay while only the page is replaced.
export default function Error(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} home="/catalogue" />;
}
