"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently refresh the current route in the background so users always
 * see fresh data — without a spinner, without a navigation delay.
 * 
 * UPDATED FOR PERFORMANCE:
 * - Removed automatic refresh on pathname change (tab switching).
 * - Added network detection: skips refresh on slow/metered connections.
 * - Extended focus refresh throttle to 60s to reduce network chatter.
 */
export function RouteRefresh() {
  const router = useRouter();
  const lastRefresh = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isSlowConnection = () => {
      // Check if the browser supports Network Information API
      if ("connection" in navigator) {
        const conn = (navigator as any).connection;
        if (conn) {
          if (conn.saveData) return true;
          if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
        }
      }
      return false;
    };

    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      
      // Don't refresh if on a slow connection
      if (isSlowConnection()) return;

      const now = Date.now();
      // Increased throttle from 10s to 60s
      if (now - lastRefresh.current < 60000) return;
      
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
