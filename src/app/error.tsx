"use client";

import { RouteError } from "@/components/route-error";

// Catches a failure in any page that has no nearer error page (login, the salesman app).
export default function Error(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} />;
}
