"use client";

import { useEffect, useState } from "react";
import { isNativePlatform } from "@/lib/native";

/**
 * Shows a small offline banner when the native shell detects that the
 * device has lost connectivity. Web uses public/sw.js + the /offline
 * fallback page instead — this component is native-only.
 *
 * Uses @capacitor/network so we get the correct status inside the
 * WebView (navigator.onLine is unreliable in iOS WKWebView).
 */
export function NativeNetworkMonitor() {
  const [offline, setOffline] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isNativePlatform()) return;
    setMounted(true);

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("@capacitor/network");
        if (cancelled) return;

        const status = await mod.Network.getStatus();
        setOffline(!status.connected);

        const handle = await mod.Network.addListener(
          "networkStatusChange",
          (s) => {
            setOffline(!s.connected);
          }
        );

        cleanup = () => {
          handle.remove();
        };
      } catch {
        /* plugin missing — no-op */
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, []);

  if (!mounted || !offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[300] flex items-center justify-center gap-2 border-b border-danger/40 bg-danger-soft px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]"
    >
      <span className="text-[0.875rem]">📡</span>
      <p className="text-[0.8125rem] font-medium text-danger">
        You dey offline — everything wey you load before still dey here.
      </p>
    </div>
  );
}