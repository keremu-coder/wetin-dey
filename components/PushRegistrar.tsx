"use client";

import { useEffect } from "react";
import { registerServiceWorker, subscribeToPush, pushSupported } from "@/lib/push-client";

export function PushRegistrar() {
  useEffect(() => {
    if (!pushSupported()) return;

    let cancelled = false;

    // Register the SW on mount. Subscribe only if permission already granted
    // (so we don't hit users with a modal on first load — they opt in via
    // the sounds settings page or the members drawer).
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