/**
 * Share wrapper.
 *
 * Inside Capacitor, uses @capacitor/share so the native share sheet
 * appears (WhatsApp, Instagram, Telegram, AirDrop, etc.). On the web,
 * uses navigator.share where supported and falls back to clipboard.
 *
 * Every share returns a result so callers can decide whether to show
 * "Link copied" feedback or not.
 *
 * Note on typing: we always access `window.navigator` (never the global
 * `navigator` variable directly) and cast it once to a type that has
 * optional `share` and `clipboard` fields. This avoids TypeScript's
 * `in`-operator narrowing misbehaving on the DOM `Navigator` type
 * under strict mode.
 */

export type ShareResult =
  | { ok: true; method: "native" | "web" | "clipboard" }
  | { ok: false; reason: "cancelled" | "error" };

let nativeModule: typeof import("@capacitor/share") | null = null;
let nativeLoadFailed = false;

async function loadNative() {
  if (nativeModule) return nativeModule;
  if (nativeLoadFailed) return null;
  try {
    nativeModule = await import("@capacitor/share");
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

type ShareableNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export async function shareUrl(params: {
  url: string;
  title?: string;
  text?: string;
}): Promise<ShareResult> {
  const { url, title = "Wetin Dey", text } = params;

  // 1. Native shell first — real OS share sheet.
  if (isNative()) {
    const mod = await loadNative();
    if (mod) {
      try {
        await mod.Share.share({
          title,
          text: text ?? "",
          url,
          dialogTitle: "Share this"
        });
        return { ok: true, method: "native" };
      } catch {
        return { ok: false, reason: "cancelled" };
      }
    }
  }

  // 2. Web Share API — works on modern iOS Safari and Android Chrome.
  if (typeof window !== "undefined") {
    const nav = window.navigator as ShareableNavigator;

    if (typeof nav.share === "function") {
      try {
        await nav.share({ title, text: text ?? "", url });
        return { ok: true, method: "web" };
      } catch {
        return { ok: false, reason: "cancelled" };
      }
    }

    // 3. Clipboard fallback.
    if (nav.clipboard && typeof nav.clipboard.writeText === "function") {
      try {
        await nav.clipboard.writeText(url);
        return { ok: true, method: "clipboard" };
      } catch {
        return { ok: false, reason: "error" };
      }
    }
  }

  return { ok: false, reason: "error" };
}