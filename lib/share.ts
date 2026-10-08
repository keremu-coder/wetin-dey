/**
 * Share wrapper.
 *
 * Inside Capacitor, uses @capacitor/share so the native share sheet
 * appears (WhatsApp, Instagram, Telegram, AirDrop, etc.). On the web,
 * uses navigator.share where supported and falls back to clipboard.
 *
 * Every share returns a result so callers can decide whether to show
 * "Link copied" feedback or not.
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

export async function shareUrl(params: {
  url: string;
  title?: string;
  text?: string;
}): Promise<ShareResult> {
  const { url, title = "Wetin Dey", text } = params;

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

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (
        navigator as Navigator & { share: (d: ShareData) => Promise<void> }
      ).share({ title, text: text ?? "", url });
      return { ok: true, method: "web" };
    } catch {
      return { ok: false, reason: "cancelled" };
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, method: "clipboard" };
  } catch {
    return { ok: false, reason: "error" };
  }
}