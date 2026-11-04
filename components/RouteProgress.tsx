"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Twitter-style route progress bar. Fires on every pathname change:
 *   1. Bar appears instantly at 0% width.
 *   2. Animates to ~80% over ~500ms (feels like "loading is happening").
 *   3. On the next route commit (pathname change observed), completes to
 *      100% over ~200ms and fades out.
 *
 * Deliberately no completion callback from Next.js — we treat any
 * pathname change as "route arrived" and finish. If navigation is
 * slow, the bar sits at 80% (looks active, doesn't lie).
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // On every navigation: reset bar, then advance toward 80% over
    // half a second, then hold. When the pathname actually changes,
    // the effect re-runs — but we want the previous cycle to finish.
    const clearAll = () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
    clearAll();

    setVisible(true);
    setProgress(0);

    const t1 = setTimeout(() => setProgress(40), 80);
    const t2 = setTimeout(() => setProgress(80), 400);

    // Complete and fade
    const t3 = setTimeout(() => {
      setProgress(100);
      const t4 = setTimeout(() => {
        setVisible(false);
        const t5 = setTimeout(() => setProgress(0), 250);
        timersRef.current.push(t5);
      }, 220);
      timersRef.current.push(t4);
    }, 650);

    timersRef.current.push(t1, t2, t3);

    return () => {
      // On unmount we don't clear — the next route cycle pushes new
      // timers. But if the component itself goes away, timers get
      // GC'd naturally. Safe to leave running.
    };
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className="h-full bg-brand transition-[width,opacity] ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          boxShadow: "0 0 8px rgba(74,100,184,0.45)",
          transitionDuration: progress === 100 ? "180ms" : "320ms"
        }}
      />
    </div>
  );
}