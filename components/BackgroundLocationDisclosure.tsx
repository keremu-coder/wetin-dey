"use client";

import { useEffect } from "react";

/**
 * Google Play Prominent Disclosure for background location.
 *
 * Required before the OS permission prompt (Android 10+ policy). Copy
 * below is written to satisfy the four items Google checks for:
 *   1. What data is collected  — precise location
 *   2. That collection continues in the background
 *   3. The exact use case       — Radar Need help / Police stop
 *   4. A clear affirmative action to continue
 *
 * Not a dark pattern: no auto-dismiss, no hidden text, no preselected
 * opt-in. "Not now" is styled as a real choice.
 */
export function BackgroundLocationDisclosure({
  open,
  onAccept,
  onDecline
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDecline();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onDecline]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bg-loc-title"
      aria-describedby="bg-loc-body"
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-card-hover">
        <h2
          id="bg-loc-title"
          className="font-serif text-[1.25rem] font-semibold leading-tight text-ink"
        >
          Share your location in the background
        </h2>

        <div id="bg-loc-body" className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-ink/85">
          <p>
            When you send a <strong>Need help</strong> or{" "}
            <strong>Police stop</strong> signal on Radar, Wetin Dey collects
            your <strong>precise location</strong> so the trusted contacts you
            chose can find you.
          </p>
          <p>
            Location is shared{" "}
            <strong>even when the app is closed or not in use</strong>, for up
            to 4 hours, or until you tap <strong>I&apos;m safe</strong>.
          </p>
          <p className="text-[0.875rem] text-muted">
            You can stop sharing at any time from the Radar screen. Only
            contacts you have both added can see your location.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onAccept}
            className="w-full rounded-xl bg-brand px-4 py-3 text-[0.9375rem] font-semibold text-white transition-opacity active:opacity-90 sm:flex-1"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="w-full rounded-xl border border-border-strong bg-paper px-4 py-3 text-[0.9375rem] font-medium text-ink transition-colors hover:bg-ink/5 sm:flex-1"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}