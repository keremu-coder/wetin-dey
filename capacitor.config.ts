import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native shell configuration.
 *
 * Notes:
 *  - server.url points at the deployed production URL. When submitting to the App Store,
 *    set server.url to the canonical production domain and ensure the binary includes
 *    genuine native functionality (push notifications, native share/haptics, offline behavior).
 *  - ios.limitsNavigationsToAppBoundDomains MUST be true for App Store compliance to avoid being flagged
 *    as a generic web wrapper. Ensure App‑Bound Domains are configured when building the iOS binary.
 */
const config: CapacitorConfig = {
  appId: "com.wetindey.app",
  appName: "Wetin Dey",
  webDir: "public",
  server: {
    url: "https://wetindey.app",
    cleartext: false,
    androidScheme: "https"
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0a0a",
    // Prevent unrestricted navigation; limit to app‑bound domains to avoid web‑wrapper rejection.
    limitsNavigationsToAppBoundDomains: true
  },
  android: {
    // Required for @capacitor-community/background-geolocation on Capacitor 8.
    // Without it, Android halts location updates after ~5 minutes in background.
    useLegacyBridge: true,
    backgroundColor: "#0a0a0a",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: "#0a0a0a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
