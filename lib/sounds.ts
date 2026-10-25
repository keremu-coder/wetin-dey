"use client";

let audioCtx: AudioContext | null = null;
const activeAudioFiles = new Set<HTMLAudioElement>();

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

export function unlockAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
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

type Tone = {
  freq: number;
  freqEnd?: number;
  start: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
};

function playTones(tones: Tone[]): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const now = ctx.currentTime;
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, now + t.start);
    if (t.freqEnd !== undefined && t.freqEnd > 0) {
      try {
        osc.frequency.exponentialRampToValueAtTime(
          t.freqEnd,
          now + t.start + t.duration
        );
      } catch {
        /* ignore */
      }
    }
    g.gain.setValueAtTime(0, now + t.start);
    g.gain.linearRampToValueAtTime(t.gain, now + t.start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.duration + 0.02);
  }
}

export type SoundProfileId =
  | "bbm"
  | "skype"
  | "whatsapp"
  | "telegram"
  | "classic"
  | "none";

export type SoundEvent = "send" | "receive" | "mention" | "notification";

type ProfileSounds = Record<SoundEvent, Tone[] | null>;

export const SOUND_PROFILES: Record<
  SoundProfileId,
  { label: string; description: string; sounds: ProfileSounds }
> = {
  bbm: {
    label: "Ping",
    description: "Classic two-tone chirp",
    sounds: {
      // Crisp, audible, but smooth like BBM
      send: [
        { freq: 880, freqEnd: 1100, start: 0, duration: 0.12, gain: 0.3 },
        { freq: 1320, freqEnd: 1760, start: 0.1, duration: 0.15, gain: 0.35 }
      ],
      receive: [
        { freq: 1046.5, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 1568.0, start: 0.1, duration: 0.15, gain: 0.35 }
      ],
      mention: [
        { freq: 698.46, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 880.0, start: 0.1, duration: 0.1, gain: 0.35 },
        { freq: 1046.5, start: 0.2, duration: 0.15, gain: 0.4 }
      ],
      notification: [
        { freq: 880, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 1174.66, start: 0.1, duration: 0.15, gain: 0.35 }
      ]
    }
  },
  skype: {
    label: "Chime",
    description: "Bright three-note, modern",
    sounds: {
      send: [
        { freq: 900, freqEnd: 2200, start: 0, duration: 0.15, gain: 0.3, type: "triangle" }
      ],
      receive: [
        { freq: 1760, start: 0, duration: 0.1, gain: 0.3, type: "triangle" },
        { freq: 1318.5, start: 0.1, duration: 0.1, gain: 0.3, type: "triangle" },
        { freq: 1760, start: 0.2, duration: 0.15, gain: 0.35, type: "triangle" }
      ],
      mention: [
        { freq: 2093, start: 0, duration: 0.08, gain: 0.35, type: "triangle" },
        { freq: 1568, start: 0.08, duration: 0.08, gain: 0.35, type: "triangle" },
        { freq: 2093, start: 0.16, duration: 0.15, gain: 0.4, type: "triangle" }
      ],
      notification: [
        { freq: 1760, start: 0, duration: 0.1, gain: 0.3, type: "triangle" },
        { freq: 1318.5, start: 0.1, duration: 0.15, gain: 0.35, type: "triangle" }
      ]
    }
  },
  whatsapp: {
    label: "Pop",
    description: "Soft pop, easy on the ear",
    sounds: {
      send: [
        { freq: 1100, freqEnd: 1800, start: 0, duration: 0.1, gain: 0.3 }
      ],
      receive: [
        { freq: 1318.5, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 1760, start: 0.08, duration: 0.15, gain: 0.35 }
      ],
      mention: [
        { freq: 1760, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 1318.5, start: 0.1, duration: 0.1, gain: 0.35 },
        { freq: 1760, start: 0.2, duration: 0.15, gain: 0.4 }
      ],
      notification: [
        { freq: 1318.5, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 1760, start: 0.1, duration: 0.15, gain: 0.35 }
      ]
    }
  },
  telegram: {
    label: "Bloop",
    description: "One crisp note",
    sounds: {
      send: [
        { freq: 1200, freqEnd: 1800, start: 0, duration: 0.12, gain: 0.35 }
      ],
      receive: [{ freq: 1400, start: 0, duration: 0.15, gain: 0.35 }],
      mention: [
        { freq: 1400, start: 0, duration: 0.1, gain: 0.35 },
        { freq: 1864.66, start: 0.1, duration: 0.15, gain: 0.4 }
      ],
      notification: [{ freq: 1400, start: 0, duration: 0.15, gain: 0.35 }]
    }
  },
  classic: {
    label: "Knock",
    description: "Descending alert tone",
    sounds: {
      send: [{ freq: 1100, start: 0, duration: 0.1, gain: 0.3 }],
      receive: [
        { freq: 880, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 660, start: 0.1, duration: 0.15, gain: 0.35 }
      ],
      mention: [
        { freq: 660, start: 0, duration: 0.1, gain: 0.3 },
        { freq: 880, start: 0.1, duration: 0.1, gain: 0.35 },
        { freq: 1046.5, start: 0.2, duration: 0.15, gain: 0.4 }
      ],
      notification: [{ freq: 880, start: 0, duration: 0.15, gain: 0.3 }]
    }
  },
  none: {
    label: "Silence",
    description: "No sound — vibration only",
    sounds: { send: null, receive: null, mention: null, notification: null }
  }
};

export function playProfile(
  profileId: SoundProfileId,
  event: SoundEvent
): void {
  const profile = SOUND_PROFILES[profileId];
  if (!profile) return;
  const tones = profile.sounds[event];
  if (!tones || tones.length === 0) return;
  playTones(tones);
}

export function vibrate(pattern: number | number[] = 30): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    vibrate?: (p: number | number[]) => boolean;
  };
  if (typeof nav.vibrate === "function") {
    try {
      nav.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

export function vibrateMention(): void {
  vibrate([40, 60, 40]);
}

export function notificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (!notificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const r = await Notification.requestPermission();
    return r === "granted";
  } catch {
    return false;
  }
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag: string
): void {
  if (!notificationSupported()) return;
  if (Notification.permission !== "granted") return;
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  ) {
    return;
  }
  try {
    new Notification(title, {
      body,
      tag,
      silent: true,
      icon: "/icon-192.png",
      badge: "/icon-192.png"
    });
  } catch {
    /* ignore */
  }
}

export function playAudioFile(url: string, volume = 1.0) {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = Math.max(0, Math.min(1, volume));
    activeAudioFiles.add(audio);

    const release = () => activeAudioFiles.delete(audio);
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("error", release, { once: true });

    const playback = audio.play();
    if (playback) void playback.catch(release);
  } catch {
    // Audio playback may be unavailable or blocked by the browser.
  }
}
