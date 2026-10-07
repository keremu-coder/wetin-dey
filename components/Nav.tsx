"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { getWhoAmI, type WhoAmI } from "@/lib/whoami-cache";

type Row = {
  href: string;
  icon: string;
  label: string;
  hint?: string;
  tone?: "default" | "accent" | "danger";
};

type Section = {
  title: string;
  rows: Row[];
};

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const colors = [
    "#C0392B",
    "#D97706",
    "#1F7A4D",
    "#7C3AED",
    "#0E7490",
    "#BE185D",
    "#4D7C0F",
    "#A16207"
  ];
  return colors[Math.abs(h) % colors.length];
}

export function Nav() {
  const pathname = usePathname();
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    getWhoAmI()
      .then((d) => {
        if (d) setMe(d);
      })
      .catch(() => {});
  }, []);

  // Pull status line for the header
  useEffect(() => {
    if (!drawerOpen || !me) return;
    let cancelled = false;
    fetch(`/api/settings/status?session_id=${encodeURIComponent(me.id)}`, {
      cache: "no-store"
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setStatus(
          typeof d?.status_line === "string" ? d.status_line : null
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, me]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  const isChatPage = /^\/c\/[^/]+\/chat/.test(pathname);

  const sections: Section[] = [
    {
      title: "Discover",
      rows: [
        {
          href: "/search",
          icon: "🔎",
          label: "Search",
          hint: "People, spaces, reports"
        },
        {
          href: "/communities",
          icon: "🧭",
          label: "Browse spaces",
          hint: "Public communities to join"
        },
        {
          href: "/explore",
          icon: "🌍",
          label: "See the pattern",
          hint: "The full civic archive"
        }
      ]
    },
    {
      title: "You",
      rows: [
        {
          href: "/me",
          icon: "👤",
          label: "My profile",
          hint: "Your posts, followers, spaces"
        },
        {
          href: "/inbox",
          icon: "✉️",
          label: "Inbox",
          hint: "Private messages"
        },
        {
          href: "/settings",
          icon: "⚙️",
          label: "Settings",
          hint: "Account, privacy, sounds, font"
        }
      ]
    },
    {
      title: "Help",
      rows: [
        {
          href: "/support",
          icon: "💬",
          label: "Support",
          hint: "Report a problem, appeal a flag"
        }
      ]
    }
  ];

  if (!me) {
    sections.push({
      title: "Get started",
      rows: [
        {
          href: "/signin",
          icon: "🔑",
          label: "Sign in or join",
          hint: "Get a handle, follow people",
          tone: "accent"
        }
      ]
    });
  }

  const gradient = me ? avatarColor(me.handle) : "#10b981";

  return (
    <>
      {!isChatPage ? (
        <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-3">
            <Link href="/" className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              <span className="font-serif text-[1.15rem] font-semibold leading-none tracking-tight text-ink">
                Wetin Dey
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <Link
                href="/search"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
                aria-label="Search"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </Link>
              <Link
                href="/submit"
                className="rounded-full bg-accent px-3 py-1.5 text-[0.8125rem] font-semibold text-white transition-all hover:bg-accent-deep"
              >
                Post
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
                aria-label="Open menu"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="4" y1="8" x2="20" y2="8" />
                  <line x1="4" y1="16" x2="20" y2="16" />
                </svg>
              </button>
            </div>
          </div>
        </header>
      ) : null}

      {drawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-[60] flex h-full w-[86%] max-w-sm flex-col overflow-hidden border-l border-border bg-paper slide-in-right">
            {/* BBM-style profile header */}
            <div
              className="relative shrink-0 px-5 pt-6 pb-5"
              style={{
                background: `linear-gradient(135deg, ${gradient} 0%, #052e1f 100%)`
              }}
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                ✕
              </button>

              {me ? (
                <Link
                  href={`/u/${encodeURIComponent(me.handle)}`}
                  className="flex items-center gap-3"
                  onClick={() => setDrawerOpen(false)}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-[1.4rem] font-semibold text-white ring-2 ring-white/30 backdrop-blur">
                    {me.handle.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[1.15rem] font-semibold text-white">
                      @{me.handle}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[0.8125rem] italic leading-snug text-white/85">
                      {status ?? "Tap to set your status…"}
                    </p>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/signin"
                  className="flex items-center gap-3"
                  onClick={() => setDrawerOpen(false)}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-[1.4rem] font-semibold text-white ring-2 ring-white/30 backdrop-blur">
                    ?
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[1.15rem] font-semibold text-white">
                      Sign in
                    </p>
                    <p className="text-[0.8125rem] text-white/85">
                      Get a handle, follow people
                    </p>
                  </div>
                </Link>
              )}
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto">
              {sections.map((section) => (
                <div key={section.title} className="pt-4">
                  <p className="px-5 pb-2 font-mono text-[0.62rem] uppercase tracking-widest text-faint">
                    {section.title}
                  </p>
                  <div>
                    {section.rows.map((row) => {
                      const active = pathname === row.href;
                      return (
                        <Link
                          key={row.href}
                          href={row.href}
                          onClick={() => setDrawerOpen(false)}
                          className={`group flex items-center gap-3 px-5 py-3.5 transition-colors ${
                            active ? "bg-ink/[0.04]" : "hover:bg-ink/5"
                          }`}
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[1.15rem] ${
                              row.tone === "accent"
                                ? "bg-accent-soft"
                                : "bg-ink/5"
                            }`}
                          >
                            <span>{row.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-[0.9375rem] font-semibold leading-tight ${
                                active ? "text-accent" : "text-ink"
                              }`}
                            >
                              {row.label}
                            </p>
                            {row.hint ? (
                              <p className="mt-0.5 truncate text-[0.75rem] text-muted">
                                {row.hint}
                              </p>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5">
                            ›
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-4">
                <p className="px-5 pb-2 font-mono text-[0.62rem] uppercase tracking-widest text-faint">
                  Appearance
                </p>
                <div className="px-5 py-2">
                  <ThemeToggle />
                </div>
              </div>

              {me ? (
                <div className="pt-4 pb-6">
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-danger-soft/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-[1.15rem]">
                      <span>↩️</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9375rem] font-semibold text-danger">
                        Sign out
                      </p>
                    </div>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border bg-paper/95 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <p className="text-center font-mono text-[0.65rem] text-faint">
                Wetin Dey · made in Nigeria 🇳🇬
              </p>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-2xl px-4 pb-28">
      <div className="border-t border-border pt-6">
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          Wetin Dey na community. Anonymous if you want. No court judgment — na
          talk.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-faint">
          <Link href="/terms" className="transition-colors hover:text-accent">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-accent">
            Privacy
          </Link>
          <Link
            href="/guidelines"
            className="transition-colors hover:text-accent"
          >
            Guidelines
          </Link>
          <Link href="/takedown" className="transition-colors hover:text-accent">
            Takedown
          </Link>
          <Link href="/support" className="transition-colors hover:text-accent">
            Support
          </Link>
          <span className="ml-auto font-mono text-[0.7rem] text-faint">
            made in Nigeria 🇳🇬
          </span>
        </div>
      </div>
    </footer>
  );
}