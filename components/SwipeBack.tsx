"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativePlatform } from "@/lib/native";
import { impactFeedback } from "@/lib/haptics";

/**
 * iOS-style swipe-from-left-edge to go back.
 *
 * Every native iOS app has this. WKWebView has a built-in version, but
 * it's only enabled in some Capacitor configurations. This component
 * provides a JS fallback that works regardless.
 *
 * How it works:
 *   1. Only active inside the Capacitor native shell.
 *   2. Only active when `window.history.length > 1` — nowhere to go back
 *      to on a fresh install / cold start, so the gesture is off.
 *   3. Gesture must start within EDGE_ZONE px of the left edge.
 *   4. If the finger moves more vertically than horizontally in the
 *      first few px, the gesture is abandoned — that's a scroll, not a
 *      swipe-back.
 *   5. On release past THRESHOLD px, `router.back()` fires with haptic.
 *
 * Silent in the browser. Safe to mount everywhere.
 */
const EDGE_ZONE = 24;
const THRESHOLD = 90;
const DIRECTION_LOCK_PX = 8;
const MAX_DRAG = 160;

export function SwipeBack() {
  const router = useRouter();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragRef = useRef(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const claimed = useRef(false);
  const declined = useRef(false);

  useEffect(() => {
    setEnabled(isNativePlatform());
  }, []);

  // Reset the visual drag on route change so a stuck drag never carries
  // across screens.
  useEffect(() => {
    dragRef.current = 0;
    setDrag(0);
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (window.history.length <= 1) return;

    function setDragValue(v: number) {
      dragRef.current = v;
      setDrag(v);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE) {
        declined.current = true;
        return;
      }
      startX.current = t.clientX;
      startY.current = t.clientY;
      claimed.current = false;
      declined.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (declined.current) return;
      if (startX.current === null || startY.current === null) return;
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;

      // Before we commit to a direction, check which axis the finger is
      // moving along. Vertical = user is scrolling, we bail for good.
      if (!claimed.current && !declined.current) {
        if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) {
          return;
        }
        if (Math.abs(dy) > Math.abs(dx)) {
          declined.current = true;
          startX.current = null;
          startY.current = null;
          return;
        }
        claimed.current = true;
      }

      if (dx <= 0) {
        setDragValue(0);
        return;
      }
      setDragValue(Math.min(MAX_DRAG, dx));
    }

    function onTouchEnd() {
      const d = dragRef.current;
      const wasClaimed = claimed.current;
      startX.current = null;
      startY.current = null;
      claimed.current = false;

      if (wasClaimed && d >= THRESHOLD) {
        void impactFeedback();
        setDragValue(0);
        router.back();
      } else {
        setDragValue(0);
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
  }, [enabled, router]);

  if (!enabled || drag === 0) return null;

  const progress = Math.min(1, drag / THRESHOLD);

  return (
    <div
      className="pointer-events-none fixed inset-y-0 left-0 z-[95] flex items-center"
      style={{ width: drag }}
      aria-hidden
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface/90 shadow-lg backdrop-blur-md"
        style={{
          marginLeft: Math.max(8, drag - 40),
          opacity: progress,
          transform: `scale(${0.7 + progress * 0.3})`
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </div>
    </div>
  );
}