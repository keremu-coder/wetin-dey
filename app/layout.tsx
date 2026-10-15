import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Nav, SiteFooter } from "@/components/Nav";
import { LiveStateProvider } from "@/components/LiveStateProvider";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PushRegistrar } from "@/components/PushRegistrar";
import { NativeNetworkMonitor } from "@/components/NativeNetworkMonitor";
import { BottomNav } from "@/components/BottomNav";
import { RouteWarmup } from "@/components/RouteWarmup";
import { RouteRefresh } from "@/components/RouteRefresh";
import { RouteProgress } from "@/components/RouteProgress";
import { AudioUnlock } from "@/components/AudioUnlock";
import { TermsGate } from "@/components/TermsGate";
import { AgeGate } from "@/components/AgeGate";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ToastProvider } from "@/components/Toast";
import { StatusBarTheme } from "@/components/StatusBarTheme";
import { SwipeBack } from "@/components/SwipeBack";
import { FONT_VARIABLE_CLASSES } from "@/lib/fonts";
import "./globals.css";

import { Onboarding } from "@/components/OnboardingLazy";

export const metadata: Metadata = {
  title: "Wetin Dey",
  description:
    "Nigerian community. Anonymous if you want. Pidgin first. Reports that stay online forever.",
  applicationName: "Wetin Dey",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wetin Dey"
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-1024.png", sizes: "1024x1024", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon-192.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#1E2F5C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('wetindey_theme') || 'system';
    var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
      document.documentElement.classList.add('native');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;
export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-csp-nonce") ?? undefined;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHost = supabaseUrl
    ? (() => {
        try {
          return new URL(supabaseUrl).host;
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          The theme bootstrap MUST run before first paint to avoid a
          light/dark flash, so it is an inline script. It carries the
          per-request CSP nonce from middleware.

          suppressHydrationWarning on the <script> element is required
          because browsers blank the nonce content attribute after
          parsing (a security feature: CSS cannot exfiltrate the nonce
          via attribute selectors). In dev, Next 15's overlay does a
          second SSR pass for error replay without the x-csp-nonce
          header, so the overlay compares an empty server nonce against
          the real client nonce and logs a hydration mismatch.

          Production renders the nonce correctly (verified in live HTML)
          and never runs the replay pass. This attribute silences the
          dev-only noise on this one element without affecting anything
          else. Do not add suppressHydrationWarning elsewhere without a
          specific reason.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />

        {/*
          Next.js emits the apple-* PWA meta tag from metadata.appleWebApp.
          Apple now asks for the unprefixed version too for forward compat.
          Not emitted automatically, so we add it manually.
        */}
        <meta name="mobile-web-app-capable" content="yes" />

        {supabaseHost ? (
          <>
            <link
              rel="preconnect"
              href={`https://${supabaseHost}`}
              crossOrigin="anonymous"
            />
            <link rel="dns-prefetch" href={`https://${supabaseHost}`} />
          </>
        ) : null}
      </head>
      <body className={`min-h-screen font-sans ${FONT_VARIABLE_CLASSES}`}>
        <ToastProvider>
          <LiveStateProvider>
            <StatusBarTheme />
            <SwipeBack />
            <PushRegistrar />
            <NativeNetworkMonitor />
            <RouteWarmup />
            <RouteRefresh />
            <RouteProgress />
            <AudioUnlock />
            <AgeGate />
            <Onboarding />
            <InstallPrompt />
            <TermsGate />
            <Nav />
            <PullToRefresh>{children}</PullToRefresh>
            <SiteFooter />
            <BottomNav />
          </LiveStateProvider>
        </ToastProvider>
      </body>
    </html>
  );
}