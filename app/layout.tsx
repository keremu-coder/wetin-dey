import type { Metadata, Viewport } from "next";
import { Nav, SiteFooter } from "@/components/Nav";
import { PresencePing } from "@/components/PresencePing";
import { Onboarding } from "@/components/Onboarding";
import { InstallPrompt } from "@/components/InstallPrompt";
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
    icon: "/icon.svg",
    apple: "/icon.svg"
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

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <PresencePing />
        <Onboarding />
        <InstallPrompt />
        <Nav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}