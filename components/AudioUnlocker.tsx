"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/chat-sound";

export function AudioUnlocker() {
  useEffect(() => {
    // Warm the context on mount (harmless if already unlocked).
    unlockAudio();

    const handler = () => unlockAudio();

    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("touchstart", handler, true);
    window.addEventListener("keydown", handler, true);
    window.addEventListener("click", handler, true);

    return () => {
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("touchstart", handler, true);
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("click", handler, true);
    };
  }, []);

  return null;
}