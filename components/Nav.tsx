"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { getWhoAmI, type WhoAmI } from "@/lib/whoami-cache";

const DRAWER_ITEMS = [
  { href: "/", label: "Talk Am", icon: "📰" },
  { href: "/community", label: "Community", icon: "🫂" },
  { href: "/communities", label: "Spaces", icon: "🏘️" },
  { href: "/radar", label: "Live Radar", icon: "📡" },
  { href: "/explore", label: "Explore", icon: "🌍" },
  { href: "/search", label: "Search", icon: "🔎" },
  { href: "/inbox", label: "Inbox", icon: "✉️" }
];

export function Nav() {
  const pathname = usePathname();
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    getWhoAmI()
      .then((d) => {
        if (d) setMe(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-3">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="font-serif text-[1.15rem] font-semibold leading-none tracking-tight text-ink">
              Wetin Dey
            </span>
          </Link>

          <div className="flex items-center gap-2">
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
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-[60] h-full w-[85%] max-w-xs overflow-y-auto border-l border-border bg-paper slide-in-right">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-paper/95 px-4 py-3 backdrop-blur">
              <span className="font-serif text-[1.1rem] font-semibold text-ink">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {me ? (
              <Link
                href="/me"
                className="block border-b border-border px-4 py-4 transition-colors hover:bg-ink/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[1.1rem] font-semibold text-white">
                    {me.handle.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">
                      @{me.handle}
                    </p>
                    <p className="text-[0.75rem] text-muted">
                      View your profile and spaces
                    </p>
                  </div>
                  <span className="text-faint">›</span>
                </div>
              </Link>
            ) : (
              <Link
                href="/signin"
                className="block border-b border-border px-4 py-4 transition-colors hover:bg-ink/5"
              >
                <p className="text-[0.9375rem] font-semibold text-ink">
                  Sign in or join
                </p>
                <p className="text-[0.75rem] text-muted">
                  Get your handle, follow people
                </p>
              </Link>
            )}

            <nav className="py-2">
              {DRAWER_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      active ? "bg-ink/5 text-ink" : "text-ink hover:bg-ink/5"
                    }`}
                  >
                    <span className="text-[1.15rem]">{item.icon}</span>
                    <span className="text-[0.9375rem] font-medium">
                      {item.label}
                    </span>
                    {active ? (
                      <span className="ml-auto h-2 w-2 rounded-full bg-accent" />
                    ) : null}
                  </Link>
                );
              })}

              <div className="my-2 border-t border-border" />

              <Link
                href="/me"
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  pathname === "/me"
                    ? "bg-ink/5 text-ink"
                    : "text-ink hover:bg-ink/5"
                }`}
              >
                <span className="text-[1.15rem]">👤</span>
                <span className="text-[0.9375rem] font-medium">
                  My profile
                </span>
              </Link>

              <Link
                href="/settings"
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  pathname === "/settings"
                    ? "bg-ink/5 text-ink"
                    : "text-ink hover:bg-ink/5"
                }`}
              >
                <span className="text-[1.15rem]">⚙️</span>
                <span className="text-[0.9375rem] font-medium">
                  Settings
                </span>
              </Link>

              <Link
                href="/support"
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  pathname === "/support"
                    ? "bg-ink/5 text-ink"
                    : "text-ink hover:bg-ink/5"
                }`}
              >
                <span className="text-[1.15rem]">💬</span>
                <span className="text-[0.9375rem] font-medium">
                  Help
                </span>
              </Link>
            </nav>

            {me ? (
              <div className="border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-3 py-2 text-left text-[0.9375rem] font-medium text-danger transition-colors hover:opacity-80"
                >
                  <span className="text-[1.15rem]">↩️</span>
                  Sign out
                </button>
              </div>
            ) : null}

            <div className="border-t border-border px-4 py-4">
              <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
                Appearance
              </p>
              <ThemeToggle />
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-2xl px-4 pb-24">
      <div className="border-t border-border pt-6">
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          Wetin Dey na community. Anonymous if you want. No court judgment — na talk.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-faint">
          <Link href="/terms" className="transition-colors hover:text-accent">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-accent">
            Privacy
          </Link>
          <Link href="/guidelines" className="transition-colors hover:text-accent">
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