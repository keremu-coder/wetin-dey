"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Silently refresh the current route in the background so users always
 * see fresh data — without a spinner, without a navigation delay.
 *
 * The client RSC cache holds the last render for 5 minutes (staleTimes
 * in next.config.mjs), so a tab switch paints instantly from cache. This
 * effect then refreshes the data a beat later (after paint) so the user
 * is never looking at stale content for long.
 *
 * Fires:
 *   - on pathname change, ~150ms after paint
 *   - on window focus, if we haven't refreshed in 10s
 *
 * Throttled to at most once per 8s to avoid hammering the server when a
 * user frantically taps between tabs.
 */
export function RouteRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const lastRefresh = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Don't fire if the tab is hidden — user isn't looking, no reason
    // to burn a network call.
    const trigger = () => {
      const now = Date.now();
      if (now - lastRefresh.current < 8000) return;
      lastRefresh.current = now;
      try {
        router.refresh();
      } catch {
        /* ignore */
      }
    };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (document.visibilityState === "visible") trigger();
    }, 150);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < 10000) return;
      lastRefresh.current = now;
      try {
        router.refresh();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);

  return null;
}