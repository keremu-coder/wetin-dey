"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type WhoAmI = { handle: string; handle_kind: string } | null;

export function UserMenu() {
  const [me, setMe] = useState<WhoAmI>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.handle && d?.handle_kind === "named") {
          setMe({ handle: d.handle, handle_kind: d.handle_kind });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  if (!loaded) return null;

  if (!me) {
    return (
      <Link
        href="/signin"
        className="rounded-xl bg-accent px-3 py-2 text-[0.8125rem] font-medium text-white shadow-button transition-all hover:bg-accent-deep sm:px-4"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        <span className="max-w-[90px] truncate text-[0.8125rem]">
          @{me.handle}
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-surface p-1 shadow-card-hover">
          <Link
            href={`/u/${encodeURIComponent(me.handle)}`}
            className="block rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
          >
            View profile
          </Link>
          <Link
            href="/me"
            className="block rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
          >
            My posts
          </Link>
          <Link
            href="/settings"
            className="block rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}