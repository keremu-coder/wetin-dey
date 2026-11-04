"use client";

import { useEffect } from "react";
import { installAudioUnlock } from "@/lib/audio-unlock";

/**
 * Mounts the shared audio-context unlock listener at app boot.
 * Renders nothing. The listener resumes audio on the first user
 * gesture so the Radar alarm can play when it fires later.
 */
export function AudioUnlock() {
  useEffect(() => {
    installAudioUnlock();
  }, []);
  return null;
}