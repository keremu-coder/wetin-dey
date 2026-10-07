import type { Metadata, Viewport } from "next";
import { Nav, SiteFooter } from "@/components/Nav";
import { PresencePing } from "@/components/PresencePing";
import { Onboarding } from "@/components/Onboarding";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PushRegistrar } from "@/components/PushRegistrar";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

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
  maximumScale: 1,
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

const CORE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

const BBM_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Pacifico&family=Permanent+Marker&family=Bebas+Neue&family=Playfair+Display:wght@400;700&display=swap";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={CORE_FONTS_HREF} />
        <link
          rel="preload"
          as="style"
          href={BBM_FONTS_HREF}
          // @ts-expect-error - onLoad is valid on <link>, React types are strict
          onLoad="this.onload=null;this.rel='stylesheet'"
        />
        <noscript>
          <link rel="stylesheet" href={BBM_FONTS_HREF} />
        </noscript>
      </head>
      <body className="min-h-screen font-sans">
        <PresencePing />
        <PushRegistrar />
        <Onboarding />
        <InstallPrompt />
        <Nav />
        {children}
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  );
}