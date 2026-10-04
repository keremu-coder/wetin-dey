import type { Metadata } from "next";
import { Nav, SiteFooter } from "@/components/Nav";
import "./globals.css";

export const metadata = {
  title: "Wetin Dey",
  description: "Nigerian community. Anonymous if you want. Pidgin first."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Nav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
