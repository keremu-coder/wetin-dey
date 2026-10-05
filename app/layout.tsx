import type { Metadata } from "next";
import { Nav, SiteFooter } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wetin Dey",
  description: "Nigerian community. Anonymous if you want. Pidgin first."
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
        <Nav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}