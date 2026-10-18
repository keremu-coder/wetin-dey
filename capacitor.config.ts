import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native shell configuration.
 *
 * Because Wetin Dey needs Next.js server features (SSR, route handlers,
 * server components), the WebView loads the production Vercel URL rather
 * than a local `out/` folder. `server.url` must point at the deployed
 * production URL — do not point it at a preview deployment, since those
 * expire.
 *
 * Native value beyond a WebView (Apple 4.2 anti-web-wrapper):
 *   - Native push notifications (APNs / FCM) — @capacitor/push-notifications
 *   - Native share sheet — @capacitor/share
 *   - Native haptics — @capacitor/haptics
 *   - Splash screen — @capacitor/splash-screen
 *   - Offline screen driven by @capacitor/network
 *
 * The native-specific wiring for each of these lives in components that
 * call `isNativePlatform()` before choosing the native or web path.
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
    limitsNavigationsToAppBoundDomains: false
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