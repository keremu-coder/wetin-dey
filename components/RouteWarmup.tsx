"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Idle prefetch of the routes users tap most.
 *
 * Runs after the current page settles. Uses requestIdleCallback so it never
 * competes with data fetches or user interaction. On slow devices, falls back
 * to setTimeout with a generous delay.
 *
 * Effect: by the time a user taps one of these routes, the RSC payload is
 * already in Next.js's client cache and navigation is instant.
 */
export function RouteWarmup() {
  const router = useRouter();

  useEffect(() => {
    const routes = ["/", "/talk", "/radar", "/inbox", "/communities", "/me"];

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
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 2000 });
      return () => {
        // No cancel in older TS types; safe to ignore
      };
    }

    const t = setTimeout(run, 800);
    return () => clearTimeout(t);
  }, [router]);

  return null;
}