"use client";

import { useEffect, useRef } from "react";
import { isNativePlatform } from "@/lib/native";

/**
 * Android foreground-service location watcher for Radar.
 *
 * Only active when:
 *   - running inside the Capacitor native shell (not web)
 *   - the caller passes active = true (they have an open need_help /
 *     police_stop signal with location_sharing on)
 *
 * On Android, this fires a foreground service notification so the OS
 * keeps location flowing while the app is backgrounded or the screen is
 * locked. On iOS, the same plugin uses CLLocationManager background mode
 * (Info.plist must include location in UIBackgroundModes).
 *
 * Coordinates are throttled to ~30s before posting to /api/radar/update-location,
 * matching the server-side API cadence.
 */
export function useBackgroundRadar(active: boolean) {
  const watcherIdRef = useRef<string | null>(null);
  const lastPostRef = useRef<number>(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (!isNativePlatform()) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    (async () => {
      try {
        const mod = await import("@capacitor-community/background-geolocation");
        if (cancelled) return;

        const id = await mod.BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "Sharing your location with your Circle",
            backgroundTitle: "Wetin Dey Radar active",
            requestPermissions: true,
            stale: false,
            distanceFilter: 10
          },
          async (location, error) => {
            if (cancelled || stoppedRef.current) return;
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
          await mod.BackgroundGeolocation.removeWatcher({ id });
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
        void import("@capacitor-community/background-geolocation")
          .then((mod) => mod.BackgroundGeolocation.removeWatcher({ id }))
          .catch(() => {});
      }
    };
  }, [active]);
}