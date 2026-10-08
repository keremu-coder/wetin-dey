/**
 * Haptic feedback wrapper.
 *
 * Inside the Capacitor native shell, uses @capacitor/haptics so we get
 * proper iOS Taptic Engine feedback (navigator.vibrate is a no-op on
 * iOS Safari and on the iOS WebView). On the web, falls back to
 * navigator.vibrate when available.
 *
 * All calls are fire-and-forget — no caller needs to await them, and
 * failures (unsupported device, permission denied, plugin missing) are
 * silently ignored.
 */

let nativeModule: typeof import("@capacitor/haptics") | null = null;
let nativeLoadFailed = false;

async function loadNative() {
  if (nativeModule) return nativeModule;
  if (nativeLoadFailed) return null;
  try {
    nativeModule = await import("@capacitor/haptics");
    return nativeModule;
  } catch {
    nativeLoadFailed = true;
    return null;
  }
}

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform();
}

function webVibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Light tap — buttons, toggles, reaction taps. ~20ms.
 */
export async function tapFeedback(): Promise<void> {
  if (isNative()) {
    const mod = await loadNative();
    if (mod) {
      try {
        await mod.Haptics.impact({ style: mod.ImpactStyle.Light });
        return;
      } catch {
        /* fall through to web */
      }
    }
  }
  webVibrate(15);
}

/**
 * Slightly heavier — send a message, submit a vote, confirm an action.
 */
export async function impactFeedback(): Promise<void> {
  if (isNative()) {
    const mod = await loadNative();
    if (mod) {
      try {
        await mod.Haptics.impact({ style: mod.ImpactStyle.Medium });
        return;
      } catch {
        /* fall through */
      }
    }
  }
  webVibrate(20);
}

/**
 * Notification-style — an incoming message or DM. Distinct rhythm.
 */
export async function notifyFeedback(): Promise<void> {
  if (isNative()) {
    const mod = await loadNative();
    if (mod) {
      try {
        await mod.Haptics.notification({
          type: mod.NotificationType.Success
        });
        return;
      } catch {
        /* fall through */
      }
    }
  }
  webVibrate(35);
}

/**
 * Mention — a message that names you. Slightly different rhythm so it
 * reads as more urgent than a regular notification.
 */
export async function mentionFeedback(): Promise<void> {
  if (isNative()) {
    const mod = await loadNative();
    if (mod) {
      try {
        await mod.Haptics.notification({
          type: mod.NotificationType.Warning
        });
        return;
      } catch {
        /* fall through */
      }
    }
  }
  webVibrate(60);
}