"use client";

import { useEffect, useState } from "react";
import { isNativePlatform } from "@/lib/native";

/**
 * Syncs the native status bar text color (time, battery, wifi) with the
 * app's current theme.
 *
 * Problem: app/layout.tsx sets appleWebApp.statusBarStyle to
 * "black-translucent" — that keeps the status bar text always light.
 * Correct in dark mode. Wrong in light mode: white text on the white
 * page is invisible.
 *
 * Fix: on native only, watch the `data-theme` attribute on <html> (set
 * by the themeScript in app/layout.tsx) and tell @capacitor/status-bar
 * which style to use:
 *
 *   dark app theme  → Style.Dark  → light text over dark background
 *   light app theme → Style.Light → dark text over light background
 *
 * Silent in the browser. Silent if the plugin isn't available (dev, old
 * builds).
 */
export function StatusBarTheme() {
  const [enabled, setEnabled] = useState(false);

  // isNativePlatform() reads window; defer to an effect for SSR safety.
  useEffect(() => {
    setEnabled(isNativePlatform());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function apply(theme: "dark" | "light") {
      try {
        // Dynamic import keeps the plugin out of the web bundle.
        const mod = await import("@capacitor/status-bar");
        const { StatusBar, Style } = mod;
        await StatusBar.setStyle({
          // Style.Dark  = light text on dark background
          // Style.Light = dark text on light background
          style: theme === "dark" ? Style.Dark : Style.Light
        });
      } catch {
        /* plugin not installed or failed — nothing to do */
      }
    }

    function currentTheme(): "dark" | "light" {
      const attr = document.documentElement.getAttribute("data-theme");
      return attr === "dark" ? "dark" : "light";
    }

    void apply(currentTheme());

    observer = new MutationObserver(() => {
      if (cancelled) return;
      void apply(currentTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
    };
  }, [enabled]);

  return null;
}