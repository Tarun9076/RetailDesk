"use client";

import { RouteError } from "@/components/route-error";

// Inside the desk layout, so the desk's header and tabs stay while only the page is replaced.
export default function Error(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} home="/desk" />;
}
