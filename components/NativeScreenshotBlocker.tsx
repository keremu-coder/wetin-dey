"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PrivacyScreen } from "@capacitor-community/privacy-screen";

export function NativeScreenshotBlocker() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function setup() {
      try {
        // This blocks screenshots and screen recording on Android
        // and blurs the app switcher on iOS
        await PrivacyScreen.enable();
        
        // Optional: Listen for screenshots on iOS to alert the user
        // (Note: iOS doesn't allow blocking, only detecting)
        if (Capacitor.getPlatform() === "ios") {
          // iOS detection logic usually requires a custom plugin
          // PrivacyScreen automatically blurs the background
        }
      } catch (e) {
        console.warn("Privacy screen failed to enable", e);
      }
    }
    setup();
  }, []);

  return null;
}