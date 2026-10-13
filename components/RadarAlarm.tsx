"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAudioContext,
  isAudioUnlocked,
  onAudioUnlock,
  tryUnlockAudio
} from "@/lib/audio-unlock";

type AlarmProps = {
  active: boolean;
  urgency: "danger" | "warn" | "info";
  onSilence?: () => void;
};

/**
 * Continuous alarm overlay shown when the recipient has an unacknowledged
 * danger signal. Uses the shared AudioContext (unlocked at app boot via
 * AudioUnlock) so sound plays even when the alarm fires from a server
 * poll rather than a user tap.
 *
 * If the shared context is still suspended (user has never interacted
 * with the page at all), the overlay shows a visible "Tap for sound"
 * fallback so the alarm is never silently broken.
 */
export function RadarAlarm({ active, urgency, onSilence }: AlarmProps) {
  const loopRef = useRef<number | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    if (!active || urgency === "info") {
      setAudioBlocked(false);
      return;
    }
    if (typeof window === "undefined") return;

    let stopped = false;

    let vibHandle: ReturnType<typeof setInterval> | null = null;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const pattern = urgency === "danger" ? [300, 200, 300, 400] : [200, 300];
      try { navigator.vibrate(pattern); } catch { /* ignore */ }
      vibHandle = setInterval(() => {
        try { navigator.vibrate(pattern); } catch { /* ignore */ }
      }, 4000);
    }

    const ctx = getAudioContext();

    function playTone(
      c: AudioContext,
      freq: number,
      start: number,
      dur: number,
      gainVal: number
    ) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(c.destination);
      const t = c.currentTime + start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(gainVal, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    function beat() {
      if (stopped || !ctx) return;
      const isDanger = urgency === "danger";
      playTone(ctx, isDanger ? 880 : 660, 0, 0.18, 0.18);
      playTone(ctx, isDanger ? 1174 : 880, 0.22, 0.22, 0.2);
    }

    if (ctx) {
      void tryUnlockAudio().then((ok) => {
        if (stopped) return;
        if (ok) {
          setAudioBlocked(false);
          beat();
        } else {
          setAudioBlocked(true);
        }
      });

      if (isAudioUnlocked()) {
        setAudioBlocked(false);
        beat();
      }

      const unsub = onAudioUnlock(() => {
        if (stopped) return;
        setAudioBlocked(false);
        beat();
      });

      loopRef.current = window.setInterval(() => {
        if (stopped) return;
        if (isAudioUnlocked()) beat();
      }, 2500);

      return () => {
        stopped = true;
        unsub();
        if (vibHandle) clearInterval(vibHandle);
        if (loopRef.current) clearInterval(loopRef.current);
        loopRef.current = null;
      };
    }

    return () => {
      stopped = true;
      if (vibHandle) clearInterval(vibHandle);
    };
  }, [active, urgency]);

  if (!active || urgency === "info") return null;

  async function handleEnableSound() {
    const ok = await tryUnlockAudio();
    setAudioBlocked(!ok);
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-0 top-0 z-[90] flex items-center justify-center px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] ${
        urgency === "danger" ? "bg-danger" : "bg-warn"
      }`}
    >
      <div className="flex w-full max-w-2xl items-center gap-3 py-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[1.1rem] text-white"
          aria-hidden
        >
          {urgency === "danger" ? "\u26A0" : "\u260E"}
        </span>
        <p className="flex-1 text-[0.9375rem] font-semibold leading-tight text-white">
          {urgency === "danger" ? "Someone needs help" : "Someone wants to reach you"}
        </p>
        {audioBlocked ? (
          <button
            type="button"
            onClick={() => void handleEnableSound()}
            className="rounded-full bg-white/30 px-3 py-1.5 text-[0.75rem] font-bold text-white"
          >
            Tap for sound
          </button>
        ) : null}
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