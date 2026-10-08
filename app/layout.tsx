import type { Metadata, Viewport } from "next";
import nextDynamic from "next/dynamic";
import { Nav, SiteFooter } from "@/components/Nav";
import { LiveStateProvider } from "@/components/LiveStateProvider";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PushRegistrar } from "@/components/PushRegistrar";
import { BottomNav } from "@/components/BottomNav";
import { RouteWarmup } from "@/components/RouteWarmup";
import { TermsGate } from "@/components/TermsGate";
import { EmailVerificationHandler } from "@/components/EmailVerificationHandler";
import { FONT_VARIABLE_CLASSES } from "@/lib/fonts";
import "./globals.css";

// Onboarding shows once for new users. Doesn't need to block first paint.
const Onboarding = nextDynamic(
  () => import("@/components/Onboarding").then((m) => m.Onboarding),
  { ssr: false }
);

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
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: ["/icon-192.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
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
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

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
        <LiveStateProvider>
          <PushRegistrar />
          <RouteWarmup />
          <Onboarding />
          <InstallPrompt />
          <TermsGate />
          <EmailVerificationHandler />
          <Nav />
          {children}
          <SiteFooter />
          <BottomNav />
        </LiveStateProvider>
      </body>
    </html>
  );
}