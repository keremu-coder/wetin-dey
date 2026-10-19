import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native shell configuration.
 * 
 * IMPORTANT FOR APPLE REVIEW:
 * - limitsNavigationsToAppBoundDomains is set to TRUE to comply with Guideline 4.2.
 * - You MUST add the following to your iOS Info.plist file (via Xcode):
 *   NSLocationWhenInUseUsageDescription: "Wetin Dey uses your location to share safety signals with your private circle."
 *   NSLocationAlwaysAndWhenInUseUsageDescription: "Wetin Dey uses background location to update your safety circle during active Radar signals."
 */
const config: CapacitorConfig = {
  appId: "app.wetindey",
  appName: "Wetin Dey",
  webDir: "public",
  server: {
    url: "https://wetindey.app",
    cleartext: false,
    allowNavigation: ["wetindey.app"]
  },
  ios: {
    limitsNavigationsToAppBoundDomains: true,
    contentInset: "always",
    scheme: "WetinDey"
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
