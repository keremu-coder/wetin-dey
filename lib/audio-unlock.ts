"use client";

/**
 * Shared AudioContext that stays unlocked for the whole session.
 *
 * Browsers start AudioContext in "suspended" state until a user gesture
 * fires. If Wetin Dey creates its own context inside RadarAlarm (which
 * runs from a server poll, not a user tap), the context stays suspended
 * and the alarm plays silently — a safety bug.
 *
 * Fix: create one context at app boot, resume it on the first real
 * gesture (touchstart / click / keydown). By the time the alarm fires,
 * the context is already running and sound plays.
 */

let ctx: AudioContext | null = null;
let unlocked = false;
const listeners: Array<() => void> = [];

function makeContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

/** Get the shared AudioContext (creates it if needed). */
export function getAudioContext(): AudioContext | null {
  if (!ctx) ctx = makeContext();
  return ctx;
}

/** True once the context has successfully resumed at least once. */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

/** Force a resume attempt (e.g. on a visible button click). */
export async function tryUnlockAudio(): Promise<boolean> {
  const c = getAudioContext();
  if (!c) return false;
  try {
    await c.resume();
    if (c.state === "running") {
      unlocked = true;
      listeners.forEach((fn) => fn());
      return true;
    }
  } catch {
    /* still blocked */
  }
  return false;
}

/** Subscribe to the "audio became unlocked" event. Returns unsubscribe. */
export function onAudioUnlock(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/**
 * Install one-shot gesture listeners that unlock the shared context on
 * the first touch / click / key press anywhere in the app. Call once at
 * app boot.
 */
export function installAudioUnlock(): void {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __wetindeyAudioHook?: boolean }).__wetindeyAudioHook) return;
  (window as unknown as { __wetindeyAudioHook?: boolean }).__wetindeyAudioHook = true;

  const fire = () => {
    void tryUnlockAudio();
  };

  for (const ev of ["touchstart", "click", "keydown", "pointerdown"]) {
    window.addEventListener(ev, fire, { capture: true, passive: true });
  }
}