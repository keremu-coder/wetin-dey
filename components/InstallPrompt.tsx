"use client";

import { useEffect, useState } from "react";
import { isNativePlatform } from "@/lib/native";

const DISMISSED_KEY = "wetindey:install-prompt-dismissed:v1";
const CHAT_VISITED_KEY = "wetindey:chat-visited:v1";
const ONBOARDED_KEY = "wetindey:onboarded:v1";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const w = window as unknown as { MSStream?: unknown };
  if (/iPad|iPhone|iPod/.test(ua) && !w.MSStream) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

/**
 * Sequencing rules for the install prompt:
 *   0. Never show inside the native Capacitor shell — installing an app
 *      that's already installed makes no sense.
 *   1. Only show if the user has been through onboarding.
 *   2. Only show if the user has actually visited a chat at least once.
 *   3. Only show if they haven't dismissed it before.
 *   4. Only show on mobile (iOS or Android).
 *   5. Show 8 seconds after landing, so we never stack with onboarding
 *      or a notification permission prompt.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNativePlatform()) return;
    if (isStandalone()) return;

    try {
      if (window.localStorage.getItem(DISMISSED_KEY)) return;
      if (!window.localStorage.getItem(ONBOARDED_KEY)) return;
      if (!window.localStorage.getItem(CHAT_VISITED_KEY)) return;
    } catch {
      return;
    }

    const p = detectPlatform();
    if (p === "other") return;
    setPlatform(p);

    const t = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[150] bg-black/50 fade-in"
        onClick={dismiss}
      />
      <div className="fixed inset-x-0 bottom-0 z-[160] rounded-t-3xl border-t border-border bg-surface px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

        <h2 className="font-serif text-[1.25rem] font-semibold text-ink">
          Add Wetin Dey to your home screen
        </h2>
        <p className="mt-1 text-[0.875rem] text-muted">
          Opens full-screen like a real app. Notifications start working.
        </p>

        <div className="mt-5 space-y-3 rounded-2xl border border-border bg-paper p-4">
          {platform === "ios" ? (
            <>
              <Step n="1" text="Tap the Share button at the bottom of Safari" />
              <Step n="2" text="Scroll down, tap Add to Home Screen" />
              <Step n="3" text="Tap Add — done" />
            </>
          ) : (
            <>
              <Step n="1" text="Tap the ⋮ menu in the top-right of Chrome" />
              <Step n="2" text="Tap Install app or Add to Home Screen" />
              <Step n="3" text="Tap Install — done" />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-xl border border-border bg-paper py-2.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5"
        >
          Maybe later
        </button>
      </div>
    </>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand font-mono text-[0.7rem] font-bold text-white">
        {n}
      </span>
      <p className="pt-0.5 text-[0.875rem] leading-snug text-ink">{text}</p>
    </div>
  );
}