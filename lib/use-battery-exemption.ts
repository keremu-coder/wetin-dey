"use client";

import { useCallback, useEffect, useState } from "react";
import { isNativePlatform } from "@/lib/native";

type BatteryPlugin = {
  isIgnoring(): Promise<{ ignoring: boolean }>;
  requestIgnore(): Promise<{ ignoring: boolean; launched?: boolean }>;
};

/**
 * Android-only helper: checks whether Wetin Dey is exempt from Doze battery
 * optimization. Without the exemption Android suspends our foreground
 * location service after the screen has been off for a while, which would
 * silently kill an active Radar signal.
 *
 * Returns:
 *   needsPrompt — true only when we're on native Android and not yet exempt.
 *   request     — opens the system "ignore battery optimizations" dialog.
 */
export function useBatteryExemption(active: boolean) {
  const [needsPrompt, setNeedsPrompt] = useState(false);

  useEffect(() => {
    if (!active) { setNeedsPrompt(false); return; }
    if (!isNativePlatform()) return;
    let cancelled = false;
    (async () => {
      try {
        const core = await import("@capacitor/core");
        const plugin = core.registerPlugin<BatteryPlugin>("BatteryOptimization");
        const { ignoring } = await plugin.isIgnoring();
        if (!cancelled) setNeedsPrompt(!ignoring);
      } catch { /* plugin missing on older builds — stay silent */ }
    })();
    return () => { cancelled = true; };
  }, [active]);

  const request = useCallback(async () => {
    try {
      const core = await import("@capacitor/core");
      const plugin = core.registerPlugin<BatteryPlugin>("BatteryOptimization");
      await plugin.requestIgnore();
      setNeedsPrompt(false);
    } catch { /* user can retry */ }
  }, []);

  return { needsPrompt, request };
}