/**
 * Native-shell detection without importing @capacitor/*.
 *
 * When the app runs inside the Capacitor WebView, Capacitor injects a
 * `window.Capacitor` global before any of our JS runs. We check for it
 * directly, so we don't need @capacitor/core installed yet (and the code
 * stays tree-shakeable in the browser).
 *
 * Once @capacitor/core is a dependency (item 4), this can be swapped to
 * `import { Capacitor } from "@capacitor/core"; return Capacitor.isNativePlatform()`
 * without changing any caller.
 */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") {
    try {
      return cap.isNativePlatform();
    } catch {
      return false;
    }
  }
  return false;
}