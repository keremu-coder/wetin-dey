"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type IconProps = { active: boolean };

function SpacesIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TalkAmIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="2.5"
          fill="currentColor"
        />
        <line
          x1="8"
          y1="9.5"
          x2="16"
          y2="9.5"
          stroke="var(--color-paper)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="13"
          x2="16"
          y2="13"
          stroke="var(--color-paper)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="16.5"
          x2="13"
          y2="16.5"
          stroke="var(--color-paper)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <line x1="8" y1="9.5" x2="16" y2="9.5" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="16.5" x2="13" y2="16.5" />
    </svg>
  );
}

/**
 * Radar = signals pulsing out from where you are, reading activity in
 * your area. Concentric arcs + center dot is the universal shorthand
 * for that. A map pin says "a place" — this says "signals around me."
 */
function RadarIcon({ active }: IconProps) {
  const outer = 9.5;
  const inner = 5.5;
  const dotR = active ? 2.25 : 1.75;
  const strokeWidth = active ? 2.4 : 1.9;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Inner pulse arc — top-right */}
      <path d={`M12 ${12 - inner}a${inner} ${inner} 0 0 1 ${inner} ${inner}`} />
      {/* Inner pulse arc — bottom-left */}
      <path d={`M12 ${12 + inner}a${inner} ${inner} 0 0 1 -${inner} -${inner}`} />
      {/* Outer pulse arc — top-right */}
      <path d={`M12 ${12 - outer}a${outer} ${outer} 0 0 1 ${outer} ${outer}`} />
      {/* Outer pulse arc — bottom-left */}
      <path d={`M12 ${12 + outer}a${outer} ${outer} 0 0 1 -${outer} -${outer}`} />
      {/* Center — you are here */}
      <circle cx="12" cy="12" r={dotR} fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS: {
  href: string;
  label: string;
  Icon: (props: IconProps) => JSX.Element;
}[] = [
  { href: "/", label: "Spaces", Icon: SpacesIcon },
  { href: "/talk", label: "Talk Am", Icon: TalkAmIcon },
  { href: "/radar", label: "Radar", Icon: RadarIcon }
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
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onMouseEnter={() => router.prefetch(href)}
              onTouchStart={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              className={`flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
                active ? "text-accent" : "text-muted hover:text-ink"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon active={active} />
              <span className="text-[0.6875rem] font-medium leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}