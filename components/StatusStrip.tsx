"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Person = {
  handle: string;
  status_line: string;
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

export function StatusStrip() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/statuses/following", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.people) return;
        setPeople(d.people as Person[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || people.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          Who set a status
        </p>
        <p className="font-mono text-[0.65rem] text-faint">
          {people.length}
        </p>
      </div>
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {people.map((p) => {
          const bg = avatarColor(p.handle);
          return (
            <Link
              key={p.handle}
              href={`/u/${encodeURIComponent(p.handle)}`}
              className="flex w-[9.5rem] shrink-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-accent/50"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[0.9rem] font-semibold text-white"
                style={{ background: bg }}
              >
                {p.handle.charAt(0).toUpperCase()}
              </div>
              <p className="truncate font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                @{p.handle}
              </p>
              <p className="line-clamp-3 text-[0.8125rem] italic leading-snug text-ink">
                {p.status_line}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}