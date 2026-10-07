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
  const [tapped, setTapped] = useState<string | null>(null);

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

  // Prefetch all three tab routes on mount, so tapping is instant
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
          const wasTapped = tapped === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch
              onClick={() => setTapped(t.href)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                active ? "text-accent" : "text-muted"
              } ${wasTapped && !active ? "opacity-70" : ""}`}
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