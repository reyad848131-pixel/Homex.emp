import { type Instrumentation } from "next";

// Captures server-side errors (Route Handlers, Server Components, Server
// Actions) into the database and, if email is configured, alerts the admin.
// Runs in the Node.js runtime only — Prisma isn't supported on Edge.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { captureError } = await import("@/lib/error-tracking");
    const message = err instanceof Error ? err.message : String(err);
    const digest =
      typeof err === "object" && err !== null && "digest" in err
        ? String((err as { digest?: unknown }).digest)
        : undefined;
    const stack = err instanceof Error ? err.stack : undefined;

    await captureError({
      message,
      digest,
      path: request.path,
      method: request.method,
      routeType: context.routeType,
      stack,
    });
  } catch {
    // Never let error tracking itself throw.
  }
};
