"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Spaces", icon: "💬" },
  { href: "/talk", label: "Talk Am", icon: "📰" },
  { href: "/inbox", label: "Inbox", icon: "✉️" }
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
  const [unread, setUnread] = useState(0);

  // Poll unread DM count for the Inbox badge
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
          const showBadge = t.href === "/inbox" && unread > 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                active ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              <span className="relative text-[1.35rem] leading-none">
                {t.icon}
                {showBadge ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 font-mono text-[0.55rem] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </span>
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