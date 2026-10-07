"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Spaces", icon: "💬" },
  { href: "/talk", label: "Talk Am", icon: "📰" },
  { href: "/radar", label: "Radar", icon: "📡" }
];

// Fullscreen / focused flows where the tab bar would be in the way
const HIDDEN_PREFIXES = [
  "/c/",
  "/signin",
  "/join",
  "/forgot-password",
  "/reset-password",
  "/submit"
];

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-paper/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid max-w-2xl grid-cols-3">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                active ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              <span className="text-[1.35rem] leading-none">{t.icon}</span>
              <span className="text-[0.7rem] font-medium leading-none">
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}