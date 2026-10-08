"use client";

import { useEffect } from "react";
import {
  registerServiceWorker,
  subscribeToPush,
  pushSupported
} from "@/lib/push-client";
import { isNativePlatform } from "@/lib/native";

/**
 * Web push registration for the browser.
 *
 * Runs only in the browser, NOT in the Capacitor native shell — service
 * workers and web-push don't work inside the iOS WKWebView. Native push
 * is handled separately (see item 6 in the follow-up task).
 */
export function PushRegistrar() {
  useEffect(() => {
    // Native shell: skip service worker + web-push entirely.
    // The native push flow is wired in a separate component.
    if (isNativePlatform()) return;
    if (!pushSupported()) return;

    let cancelled = false;

    (async () => {
      await registerServiceWorker();
      if (cancelled) return;
      if (Notification.permission === "granted") {
        await subscribeToPush();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}