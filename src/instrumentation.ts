import type { Instrumentation } from "next";

/**
 * Next.js calls this for every error on the server: a page that fails to render, an API route that throws.
 * Each one is written to the error log and, if ALERT_WEBHOOK_URL is set, sent to chat.
 * Only the message, the route and a reference are kept: never the request, its headers or its body.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordServerError } = await import("./lib/monitoring/record");
  const error = err as { message?: string; stack?: string; digest?: string } | null;
  await recordServerError({
    message: error?.message ?? String(err),
    stack: error?.stack,
    digest: error?.digest,
    route: context.routePath || request.path.split("?")[0],
    method: request.method,
  });
};
