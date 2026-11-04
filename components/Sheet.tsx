"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bottom-sheet primitive.
 *
 * Every sheet in the app used to hand-roll this. They all shared the
 * same visual (backdrop + bottom-anchored panel + fake drag handle) but
 * none of them had the swipe-down gesture that makes a sheet feel native.
 * This extracts the whole thing into one place.
 *
 * Behaviour:
 *   - Slides up from the bottom on mount.
 *   - User can drag the sheet down by grabbing the handle, or by
 *     starting the drag anywhere in the content when the content is
 *     already scrolled to the top.
 *   - Drag past DISMISS_THRESHOLD → slides off and calls onClose().
 *   - Drag not far enough → springs back to 0.
 *   - Lock body scroll while open.
 *   - Escape key closes (browser convenience).
 *
 * The parent owns the open/closed state; this component is only
 * rendered while open. The exit animation runs *before* onClose fires,
 * so the sheet visually slides away instead of vanishing.
 */
const DISMISS_THRESHOLD = 100;
const MAX_DRAG = 800;
const TOP_DRAG_ZONE = 56;
const EXIT_ANIM_MS = 220;

export function Sheet({
  onClose,
  children,
  className = ""
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [drag, setDrag] = useState(MAX_DRAG);
  const [dismissing, setDismissing] = useState(false);
  const dragRef = useRef(0);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Slide-in: start off-screen, animate to 0 after React commits the
  // initial paint. 20ms timeout is enough — smaller than a frame.
  useEffect(() => {
    const t = setTimeout(() => {
      dragRef.current = 0;
      setDrag(0);
    }, 20);
    return () => clearTimeout(t);
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape to close (browser convenience).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (dismissing) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const t = e.touches[0];
    const inTopZone = t.clientY - rect.top < TOP_DRAG_ZONE;
    const content = contentRef.current;
    const contentAtTop = !content || content.scrollTop <= 0;
    // We only start the drag from the handle area, or from the content
    // when the content itself has nothing left to scroll up.
    if (!inTopZone && !contentAtTop) return;
    startY.current = t.clientY;
    dragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!dragging.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      dragRef.current = 0;
      setDrag(0);
      return;
    }
    const v = Math.min(MAX_DRAG, dy);
    dragRef.current = v;
    setDrag(v);
  }

  function onTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    startY.current = null;
    if (dragRef.current >= DISMISS_THRESHOLD) {
      setDismissing(true);
      setDrag(MAX_DRAG);
      window.setTimeout(onClose, EXIT_ANIM_MS);
    } else {
      dragRef.current = 0;
      setDrag(0);
    }
  }

  const transition = dragging.current
    ? "none"
    : "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)";

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50"
        style={{
          opacity: dismissing ? 0 : 1,
          transition: "opacity 200ms ease-out"
        }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className={`fixed inset-x-0 bottom-0 z-[80] rounded-t-3xl border-t border-border bg-surface ${className}`}
        style={{ transform: `translateY(${drag}px)`, transition }}
      >
        <div className="mx-auto my-4 h-1 w-10 rounded-full bg-border-strong" />
        <div
          ref={contentRef}
          className="max-h-[80vh] overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          style={{ overscrollBehavior: "contain" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}