"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

const HOSTS = new Set(["wetindey.app", "www.wetindey.app"]);

export function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    (async () => {
      const { App } = await import("@capacitor/app");
      if (cancelled) return;

      // Android Back Button
      handles.push(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack && window.history.length > 1) {
            router.back();
          } else {
            void App.minimizeApp();
          }
        })
      );

      // Deep Links
      handles.push(
        await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const u = new URL(url);
            if (HOSTS.has(u.hostname)) router.push(u.pathname + u.search + u.hash);
          } catch {}
        })
      );
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => void h.remove());
    };
  }, [router]);

  return null;
}
