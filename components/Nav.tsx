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
  badge?: number;
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

function isFullscreenRoute(pathname: string): boolean {
  if (/^\/c\/[^/]+\/chat/.test(pathname)) return true;
  if (/^\/inbox\/[^/]+/.test(pathname)) return true;
  return false;
}

export function Nav() {
  const pathname = usePathname();
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  useEffect(() => {
    getWhoAmI()
      .then((d) => {
        if (d) setMe(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      fetch("/api/dm/unread", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          setUnreadDMs(typeof d?.count === "number" ? d.count : 0);
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

  useEffect(() => {
    if (!drawerOpen || !me) return;
    let cancelled = false;
    fetch(`/api/settings/status?session_id=${encodeURIComponent(me.id)}`, {
      cache: "no-store"
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setStatus(typeof d?.status_line === "string" ? d.status_line : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, me]);

  useEffect(() => {
    setDrawerOpen(false);
    setSignOutConfirm(false);
  }, [pathname]);

  async function performSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      /* ignore */
    }
    window.location.href = "/signin";
  }

  const hideNav = isFullscreenRoute(pathname);

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
          hint:
            unreadDMs > 0
              ? `${unreadDMs} new message${unreadDMs === 1 ? "" : "s"}`
              : "Private messages",
          badge: unreadDMs > 0 ? unreadDMs : undefined
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
      title: "Privacy",
      rows: [
        {
          href: "/settings/dm",
          icon: "🛡️",
          label: "Direct messages",
          hint: "Who can start a conversation with you"
        },
        {
          href: "/settings/presence",
          icon: "👁️",
          label: "Presence",
          hint: "Hide your online status"
        },
        {
          href: "/settings/blocked",
          icon: "🚫",
          label: "Blocked users",
          hint: "People you no longer see"
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

  const gradient = me ? avatarColor(me.handle) : "#10b981";

  return (
    <>
      {!hideNav ? (
        <header
          className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-md"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
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
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
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
                {unreadDMs > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 font-mono text-[0.55rem] font-bold text-white">
                    {unreadDMs > 9 ? "9+" : unreadDMs}
                  </span>
                ) : null}
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
            <div
              className="relative shrink-0 px-5 pb-5"
              style={{
                paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
                background: `linear-gradient(135deg, ${gradient} 0%, #052e1f 100%)`
              }}
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
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
              ) : null}
            </div>

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
                            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[1.15rem] ${
                              row.tone === "accent"
                                ? "bg-accent-soft"
                                : "bg-ink/5"
                            }`}
                          >
                            <span>{row.icon}</span>
                            {row.badge ? (
                              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 font-mono text-[0.55rem] font-bold text-white">
                                {row.badge > 9 ? "9+" : row.badge}
                              </span>
                            ) : null}
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
                  {!signOutConfirm ? (
                    <button
                      type="button"
                      onClick={() => setSignOutConfirm(true)}
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
                  ) : (
                    <div className="mx-5 rounded-2xl border border-danger/30 bg-danger-soft p-4">
                      <p className="text-[0.875rem] font-semibold text-ink">
                        Sign out?
                      </p>
                      <p className="mt-1 text-[0.75rem] leading-relaxed text-ink/80">
                        You&apos;ll need your <strong>recovery code</strong> to
                        sign back in. If you haven&apos;t saved it, go to{" "}
                        <Link
                          href="/settings/account"
                          className="underline"
                          onClick={() => setDrawerOpen(false)}
                        >
                          Settings → Account
                        </Link>{" "}
                        first.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSignOutConfirm(false)}
                          className="flex-1 rounded-lg border border-border-strong bg-paper py-2 text-[0.8125rem] font-medium text-ink"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={performSignOut}
                          className="flex-1 rounded-lg bg-danger py-2 text-[0.8125rem] font-semibold text-white"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div
              className="shrink-0 border-t border-border bg-paper/95 px-5 py-3"
              style={{
                paddingBottom:
                  "calc(0.75rem + env(safe-area-inset-bottom, 0px))"
              }}
            >
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