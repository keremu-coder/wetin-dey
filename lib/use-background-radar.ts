"use client";

import { useEffect, useRef } from "react";
import { isNativePlatform } from "@/lib/native";

type BgLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  time: number;
};

type BgError = { code: string; message: string };

type WatcherOptions = {
  backgroundMessage?: string;
  backgroundTitle?: string;
  requestPermissions?: boolean;
  stale?: boolean;
  distanceFilter?: number;
};

type BgGeo = {
  addWatcher(
    options: WatcherOptions,
    callback: (location: BgLocation | null, error: BgError | null) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
};

/**
 * Android foreground-service location watcher for Radar.
 *
 * Loaded through Capacitor's registerPlugin proxy because the community
 * plugin has no bundled JS entrypoint — it lives only as a native
 * plugin registered at app launch.
 *
 * Only active when:
 *   - running inside the Capacitor native shell (not web)
 *   - the caller passes active = true
 */
export function useBackgroundRadar(active: boolean) {
  const watcherIdRef = useRef<string | null>(null);
  const lastPostRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    if (!isNativePlatform()) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    (async () => {
      try {
        const core = await import("@capacitor/core");
        const bg = core.registerPlugin<BgGeo>("BackgroundGeolocation");
        if (cancelled) return;

        const id = await bg.addWatcher(
          {
            backgroundMessage: "Sharing your location with your Circle",
            backgroundTitle: "Wetin Dey Radar active",
            requestPermissions: true,
            stale: false,
            distanceFilter: 10
          },
          async (location, error) => {
            if (cancelled) return;
            if (error) {
              if (error.code === "NOT_AUTHORIZED") {
                console.warn("[radar/bg] location permission denied");
              }
              return;
            }
            if (!location) return;
            const now = Date.now();
            if (now - lastPostRef.current < 25_000) return;
            lastPostRef.current = now;
            try {
              await fetch("/api/radar/update-location", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  lat: location.latitude,
                  lng: location.longitude
                })
              });
            } catch {
              /* network error, next tick will retry */
            }
          }
        );

        if (cancelled) {
          await bg.removeWatcher({ id });
          return;
        }
        watcherIdRef.current = id;
      } catch (err) {
        console.warn("[radar/bg] setup failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      const id = watcherIdRef.current;
      watcherIdRef.current = null;
      if (id) {
        void import("@capacitor/core")
          .then(async (core) => {
            const bg = core.registerPlugin<BgGeo>("BackgroundGeolocation");
            await bg.removeWatcher({ id });
          })
          .catch(() => {});
      }
    };
  }, [active]);
}