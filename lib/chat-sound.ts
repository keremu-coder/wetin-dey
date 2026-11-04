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
 * Force-unlock the AudioContext after a user gesture.
 * Browsers block audio playback until the user has interacted with the page.
 * Safe to call from any click/touch/keydown handler.
 */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  // Silent 1-frame buffer — the reliable iOS Safari unlock trick.
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

// Auto-unlock on the very first user gesture. Runs once when this module
// loads on the client, so any tap anywhere on the page makes future pings work.
if (typeof window !== "undefined") {
  const handler = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("touchstart", handler, true);
    window.removeEventListener("keydown", handler, true);
    window.removeEventListener("click", handler, true);
  };
  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("touchstart", handler, true);
  window.addEventListener("keydown", handler, true);
  window.addEventListener("click", handler, true);
}

function playTones(
  tones: Array<{ freq: number; start: number; duration: number; gain: number }>
): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  for (const t of tones) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(t.freq, now + t.start);
    g.gain.setValueAtTime(0, now + t.start);
    g.gain.linearRampToValueAtTime(t.gain, now + t.start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.duration + 0.02);
  }
}

/** Standard two-tone ping. */
export function playPing(): void {
  playTones([
    { freq: 1046.5, start: 0, duration: 0.09, gain: 0.14 },
    { freq: 1568.0, start: 0.09, duration: 0.14, gain: 0.16 }
  ]);
}

/** Mention ping — three ascending tones. */
export function playMentionPing(): void {
  playTones([
    { freq: 698.46, start: 0, duration: 0.08, gain: 0.12 },
    { freq: 880.0, start: 0.07, duration: 0.09, gain: 0.14 },
    { freq: 1046.5, start: 0.15, duration: 0.16, gain: 0.16 }
  ]);
}

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

export function vibrateMention(): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
  };
  if (typeof nav.vibrate === "function") {
    try {
      nav.vibrate([40, 60, 40]);
    } catch {
      /* ignore */
    }
  }
}