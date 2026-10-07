"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/", label: "Spaces", icon: "💬" },
  { href: "/talk", label: "Talk Am", icon: "📰" },
  { href: "/radar", label: "Radar", icon: "📡" }
];

const HIDDEN_PREFIXES = [
  "/c/",
  "/inbox/",
  "/signin",
  "/join",
  "/forgot-password",
  "/reset-password",
  "/submit"
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      fetch("/api/dm/unread", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          setUnread(typeof d?.count === "number" ? d.count : 0);
        })
        .catch(() => {});
    }
    refresh();
    const t = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pathname]);

  // Prefetch all three tabs on mount so a cold first tap is instant.
  useEffect(() => {
    for (const tab of TABS) {
      router.prefetch(tab.href);
    }
  }, [router]);

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
              prefetch
              onMouseEnter={() => router.prefetch(t.href)}
              onTouchStart={() => router.prefetch(t.href)}
              onFocus={() => router.prefetch(t.href)}
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