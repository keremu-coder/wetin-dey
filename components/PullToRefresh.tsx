"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativePlatform } from "@/lib/native";
import { impactFeedback } from "@/lib/haptics";

/**
 * Native pull-to-refresh.
 *
 * iOS and Android both have this gesture; the browser does not expose it
 * to web apps, so it has to be faked from touch events. This component:
 *
 *   1. Only activates inside the Capacitor native shell. In a browser it
 *      renders children straight through, so it never fights with Chrome
 *      or Safari's own scroll behaviour.
 *   2. Bails out on fullscreen routes (`/c/[slug]/chat`, `/inbox/[id]`).
 *      Those screens scroll an inner container, not the window. Without
 *      this guard, a pull inside the chat would trigger the refresh
 *      indicator, which is wrong.
 *   3. Listens for a downward drag that *starts* when the page is
 *      already scrolled to the top. Once the finger moves the page, the
 *      gesture is dead until the user lifts and pulls again from the top.
 *   4. Fires `router.refresh()` on release past the threshold, with
 *      haptic feedback so it feels native on a real device.
 *
 * The children are always wrapped in the same div regardless of enabled
 * state, so flipping between native and browser never remounts them.
 */
const PULL_THRESHOLD = 70;
const MAX_PULL = 120;
const DAMPING = 0.5;
const RESET_DELAY_MS = 700;

// Keep this in sync with `isFullscreenRoute` in components/Nav.tsx.
// Duplicated rather than shared to avoid a refactor of Nav.tsx in the
// same session; both files are tiny and both lists change together.
function isFullscreenRoute(pathname: string): boolean {
  if (/^\/c\/[^/]+\/chat/.test(pathname)) return true;
  if (/^\/inbox\/[^/]+/.test(pathname)) return true;
  return false;
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const refreshingRef = useRef(false);

  // `isNativePlatform()` reads `window`, so it must not run during SSR.
  // Deferring to an effect keeps server and first-client render identical
  // (no hydration mismatch in the native shell).
  useEffect(() => {
    setEnabled(isNativePlatform());
  }, []);

  const fullscreen = isFullscreenRoute(pathname);
  const active = enabled && !fullscreen;

  useEffect(() => {
    if (!active) return;

    function setPullValue(v: number) {
      pullRef.current = v;
      setPull(v);
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      dragging.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!dragging.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPullValue(0);
        return;
      }
      setPullValue(Math.min(MAX_PULL, dy * DAMPING));
    }

    function trigger() {
      refreshingRef.current = true;
      setRefreshing(true);
      setPullValue(PULL_THRESHOLD);
      void impactFeedback();
      router.refresh();
      window.setTimeout(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullValue(0);
      }, RESET_DELAY_MS);
    }

    function onTouchEnd() {
      if (!dragging.current) return;
      dragging.current = false;
      startY.current = null;
      if (pullRef.current >= PULL_THRESHOLD && !refreshingRef.current) {
        trigger();
      } else {
        setPullValue(0);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [active, router]);

  // On fullscreen routes, snap pull back to zero so a residual drag value
  // from the previous screen never bleeds through as a visual offset.
  useEffect(() => {
    if (fullscreen && pull !== 0) {
      pullRef.current = 0;
      setPull(0);
    }
  }, [fullscreen, pull]);

  const progress = Math.min(1, pull / PULL_THRESHOLD);
  const transition = dragging.current ? "none" : "transform 250ms ease-out";

  return (
    <>
      {active && pull > 0 ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
          style={{
            top: "calc(0.5rem + env(safe-area-inset-top, 0px))",
            transform: `translateY(${pull}px)`,
            transition
          }}
          aria-hidden
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-lg">
            {refreshing ? (
              <span className="block h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-accent" />
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
                style={{
                  transform: `rotate(${progress * 180}deg)`,
                  transition: "transform 150ms ease-out"
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>
        </div>
      ) : null}
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition
        }}
      >
        {children}
      </div>
    </>
  );
}