"use client";

import { useEffect } from "react";
import {
  registerServiceWorker,
  subscribeToPush,
  pushSupported
} from "@/lib/push-client";
import { isNativePlatform } from "@/lib/native";

type NativePlatform = "ios" | "android";

function getNativePlatform(): NativePlatform | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as {
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
    };
  }).Capacitor;
  if (!cap) return null;
  if (
    typeof cap.isNativePlatform === "function" &&
    !cap.isNativePlatform()
  ) {
    return null;
  }
  const p = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
  if (p === "ios" || p === "android") return p;
  return null;
}

/**
 * Push registration.
 *
 * Browser:
 *   registers public/sw.js + VAPID web-push subscription.
 *
 * Native (Capacitor):
 *   registers with APNs (iOS) or FCM (Android) via
 *   @capacitor/push-notifications, sends the resulting device token to
 *   /api/push/native-subscribe, and wires notification tap to open the
 *   deep link in the payload.
 *
 * The web-push path is entirely skipped inside the native shell because
 * service workers and web-push don't work inside the iOS WKWebView.
 */
export function PushRegistrar() {
  useEffect(() => {
    const nativePlatform = getNativePlatform();

    // Native push requires Firebase (Android) + APNs (iOS) to be
    // configured. Until those are wired, skip registration entirely
    // so we don't show a permission prompt for a feature that cannot
    // deliver, and don't risk register() throwing on Android without
    // google-services.json. Flip NEXT_PUBLIC_NATIVE_PUSH_ENABLED to
    // 'true' in Vercel env vars once Firebase + APNs are ready.
    const nativePushEnabled =
      process.env.NEXT_PUBLIC_NATIVE_PUSH_ENABLED === "true";

    if (nativePlatform) {
      if (!nativePushEnabled) return;
      // iOS native push needs an APNs Auth Key uploaded to Firebase.
      // Until that's done the permission prompt leads nowhere, which is
      // worse than no prompt. Gate iOS off here; remove once APNs is wired.
      if (nativePlatform === 'ios') return;
      let cancelled = false;
      const cleanups: Array<() => void | Promise<void>> = [];

      (async () => {
        try {
          const mod = await import("@capacitor/push-notifications");
          if (cancelled) return;

          const perm = await mod.PushNotifications.requestPermissions();
          if (perm.receive !== "granted") return;
          if (cancelled) return;

          const regHandle = await mod.PushNotifications.addListener(
            "registration",
            async (token) => {
              try {
                await fetch("/api/push/native-subscribe", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    platform: nativePlatform,
                    token: token.value
                  })
                });
              } catch {
                /* non-fatal — retried on next app open */
              }
            }
          );

          const errHandle = await mod.PushNotifications.addListener(
            "registrationError",
            (err) => {
              console.warn("[native push] registration error:", err.error);
            }
          );

          const recvHandle = await mod.PushNotifications.addListener(
            "pushNotificationReceived",
            () => {
              /* capacitor.config.ts presentationOptions handles the banner */
            }
          );

          const actHandle = await mod.PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action) => {
              const data = action.notification.data as
                | { url?: unknown }
                | undefined;
              const url =
                data && typeof data.url === "string" ? data.url : "/";
              try {
                window.location.href = url;
              } catch {
                /* ignore */
              }
            }
          );

          cleanups.push(
            () => regHandle.remove(),
            () => errHandle.remove(),
            () => recvHandle.remove(),
            () => actHandle.remove()
          );

          await mod.PushNotifications.register();
        } catch (err) {
          console.warn("[native push] setup failed:", err);
        }
      })();

      return () => {
        cancelled = true;
        for (const fn of cleanups) {
          try {
            void fn();
          } catch {
            /* ignore */
          }
        }
      };
    }

    // Browser: web push via service worker.
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
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