"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

/**
 * Idle prefetch of the routes users tap most.
 *
 * Runs after the current page settles. Uses requestIdleCallback so it
 * never competes with data fetches or user interaction. On slow devices,
 * falls back to setTimeout with a generous delay.
 *
 * Skipped entirely when the user has data saver enabled or is on a slow
 * connection (effectiveType 2g or slow-2g). Prefetching 6 routes on
 * those devices would burn bandwidth the user explicitly asked us to
 * conserve.
 *
 * Effect for everyone else: by the time a user taps one of these routes,
 * the RSC payload is already in Next.js's client cache and navigation
 * feels instant.
 */
export function RouteWarmup() {
  const router = useRouter();

  useEffect(() => {
    // Respect the user's data-saving preference.
    const conn = (navigator as Navigator & { connection?: NetworkInformation })
      .connection;
    if (conn) {
      if (conn.saveData === true) return;
      const et = conn.effectiveType;
      if (et === "slow-2g" || et === "2g") return;
    }

    const routes = ["/", "/talk", "/inbox", "/communities", "/me"];

    const run = () => {
      for (const r of routes) {
        try {
          router.prefetch(r);
        } catch {
          /* ignore */
        }
      }
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(run, { timeout: 2000 });
      return;
    }

    const t = setTimeout(run, 800);
    return () => clearTimeout(t);
  }, [router]);

  return null;
}