"use client";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a two-tone BBM-style ping.
 * Tone A: 1046 Hz (C6) for 80ms
 * Tone B: 1568 Hz (G6) for 120ms, offset by 90ms
 * Overall decay ~300ms
 */
export function playBbmPing(): void {
  const ctx = getCtx();
  if (!ctx) return;

  // Resume if suspended (browsers require user gesture first time)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  function tone(freq: number, start: number, duration: number, gainVal: number) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + start);

    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(gainVal, now + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.02);
  }

  tone(1046.5, 0, 0.09, 0.12);
  tone(1568.0, 0.09, 0.14, 0.14);
}

/** Short haptic tap (Android + iOS 13+) */
export function vibrate(ms = 30): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
  };
  if (typeof nav.vibrate === "function") {
    try {
      nav.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}