// Server-side error hook: every unhandled request error is logged as one structured line,
// which shows up in the hosting provider's runtime logs. Swap in Sentry here if wanted.
export function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      level: "error",
      msg: e.message,
      stack: e.stack?.split("\n").slice(0, 6),
      method: request.method,
      path: request.path,
      route: context.routePath,
      type: context.routeType,
    }),
  );
}
