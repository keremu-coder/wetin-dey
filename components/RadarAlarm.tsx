"use client";

import { useEffect, useRef } from "react";

type AlarmProps = {
  active: boolean;
  urgency: "danger" | "warn" | "info";
  onSilence?: () => void;
};

/**
 * Continuous alarm overlay shown when the recipient has an unacknowledged
 * danger signal. Uses Web Audio to loop a two-tone chime while active.
 *
 * Browsers require a user gesture before audio can play. If audio is
 * blocked, a visible banner + vibration fallback still fires. The user
 * silences by acknowledging the signal (not by tapping the overlay).
 */
export function RadarAlarm({ active, urgency, onSilence }: AlarmProps) {
  const ctxRef = useRef<AudioContext | null>(null);
  const loopRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || urgency === "info") return;
    if (typeof window === "undefined") return;

    // Vibrate pattern in browsers that support it. Loops every 4s.
    let vibHandle: ReturnType<typeof setInterval> | null = null;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const pattern = urgency === "danger" ? [300, 200, 300, 400] : [200, 300];
      try { navigator.vibrate(pattern); } catch { /* ignore */ }
      vibHandle = setInterval(() => {
        try { navigator.vibrate(pattern); } catch { /* ignore */ }
      }, 4000);
    }

    // Web Audio: two-tone chime, repeats every 2.5s.
    let stopped = false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      ctxRef.current = ctx;

      function playTone(freq: number, start: number, dur: number, gainVal: number) {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = "sine";
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime + start;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(gainVal, t + 0.02);
        gain.gain.linearRampToValueAtTime(0, t + dur);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }

      function beat() {
        if (stopped) return;
        const isDanger = urgency === "danger";
        playTone(isDanger ? 880 : 660, 0, 0.18, 0.18);
        playTone(isDanger ? 1174 : 880, 0.22, 0.22, 0.2);
      }

      // Browsers block audio until a user gesture. Try; if suspended, resume on next tap.
      ctx.resume().then(beat).catch(() => { /* user must tap once */ });
      loopRef.current = window.setInterval(beat, 2500);
    }

    return () => {
      stopped = true;
      if (vibHandle) clearInterval(vibHandle);
      if (loopRef.current) clearInterval(loopRef.current);
      try { ctxRef.current?.close(); } catch { /* ignore */ }
      ctxRef.current = null;
      loopRef.current = null;
    };
  }, [active, urgency]);

  if (!active || urgency === "info") return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-0 top-0 z-[90] flex items-center justify-center px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] ${urgency === "danger" ? "bg-danger" : "bg-warn"}`}
    >
      <div className="flex w-full max-w-2xl items-center gap-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[1.1rem] text-white" aria-hidden>
          {urgency === "danger" ? "\u26A0" : "\u260E"}
        </span>
        <p className="flex-1 text-[0.9375rem] font-semibold leading-tight text-white">
          {urgency === "danger" ? "Someone needs help" : "Someone wants to reach you"}
        </p>
        {onSilence ? (
          <button
            type="button"
            onClick={onSilence}
            className="rounded-full bg-white/20 px-3 py-1.5 text-[0.75rem] font-semibold text-white"
          >
            Silence
          </button>
        ) : null}
      </div>
    </div>
  );
}