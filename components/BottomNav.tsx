"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type IconProps = { active: boolean };

function SpacesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TalkAmIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <line x1="8" y1="9.5" x2="16" y2="9.5" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="16.5" x2="13" y2="16.5" />
    </svg>
  );
}

function YouIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

const TABS: { href: string; label: string; Icon: () => JSX.Element }[] = [
  { href: "/", label: "Spaces", Icon: SpacesIcon },
  { href: "/talk", label: "Talk Am", Icon: TalkAmIcon },
  { href: "/me", label: "You", Icon: YouIcon }
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
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: "var(--shadow-nav)" }}>
      <div className="mx-auto grid max-w-2xl grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} prefetch onMouseEnter={() => router.prefetch(href)} onTouchStart={() => router.prefetch(href)} onFocus={() => router.prefetch(href)} className="flex min-h-[72px] flex-col items-center justify-center gap-1 py-2" aria-current={active ? "page" : undefined}>
              <span className="flex h-8 items-center justify-center rounded-2xl px-4 transition-colors" style={{ background: active ? "var(--brand-ink-tint)" : "transparent" }}>
                <span style={{ color: active ? "var(--brand-ink)" : "var(--color-faint)" }}>
                  <Icon />
                </span>
              </span>
              <span className="text-[12px] font-semibold leading-none" style={{ color: active ? "var(--color-ink)" : "var(--color-faint)" }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}