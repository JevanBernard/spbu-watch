import { useCallback, useEffect, useState } from "react";

export const REFRESH_MS = 60_000;

/** Fetches `url` now and then every minute while the tab is visible. Keeps the last good data on errors. */
export function useRefreshing<T>(url: string, pick: (json: never) => T, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // The API routes send `stale-while-revalidate`. Browsers apply it too, so a plain fetch can be answered from
  // the browser cache with the PREVIOUS data while a refresh runs in the background: every update would then
  // show one step late (an admin tap seemed to need two taps). `no-cache` always checks with the server.
  // `fresh` additionally gives the request its own URL so it also skips the CDN copy (up to ~90 s old); it is used
  // right after the visitor or admin saved something, so their change shows at once.
  const load = useCallback(async (fresh = false) => {
    try {
      const target = fresh ? `${url}${url.includes("?") ? "&" : "?"}fresh=${Date.now()}` : url;
      const res = await fetch(target, { cache: fresh ? "no-store" : "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      setData(pick((await res.json()) as never));
      setUpdatedAt(new Date());
      setError(false);
    } catch {
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      load();
      timer = setInterval(() => load(), REFRESH_MS);
    };
    const stop = () => clearInterval(timer);
    const onVisibility = () => {
      stop();
      if (document.visibilityState === "visible") start();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const reload = useCallback(() => load(true), [load]);

  return { data, error, updatedAt, reload };
}
