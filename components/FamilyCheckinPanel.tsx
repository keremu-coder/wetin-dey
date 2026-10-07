"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SpaceRow = {
  community_id: string;
  slug: string;
  name: string;
  emoji: string;
  avatar_url: string | null;
  request_id: string | null;
  reason: string | null;
  started_at: string | null;
  total_members: number;
  answered: number;
  pending: number;
  help_count: number;
};

export function FamilyCheckinPanel() {
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/checkins/active", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.spaces) {
        setSpaces(json.spaces as SpaceRow[]);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void load();
    }, 60000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-[0.875rem] text-muted">Loading…</p>
      </div>
    );
  }

  const active = spaces.filter((s) => s.request_id);
  const idle = spaces.filter((s) => !s.request_id);

  if (spaces.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="text-[2.5rem]">🏠</div>
        <p className="mt-3 font-serif text-[1.05rem] font-semibold text-ink">
          No spaces yet
        </p>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
          Family check-in works inside Spaces. Create one for your family,
          church cell, or estate.
        </p>
        <Link
          href="/communities/new"
          className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Create a space
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active.length > 0 ? (
        <section>
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            Active right now
          </p>
          <div className="space-y-2">
            {active.map((s) => (
              <Link
                key={s.community_id}
                href={`/c/${s.slug}/checkin`}
                className="flex items-start gap-3 rounded-2xl border-2 border-gold/50 bg-gold-soft/40 p-4 transition-colors hover:border-gold"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/5 text-[1.35rem]">
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatar_url}
                      alt={s.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    s.emoji
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">
                      {s.name}
                    </p>
                    <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase text-ink">
                      Active
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    {s.answered} of {s.total_members} have answered
                    {s.help_count > 0 ? ` · ${s.help_count} need help` : ""}
                  </p>
                  {s.reason ? (
                    <p className="mt-1 text-[0.75rem] italic text-ink/75">
                      &ldquo;{s.reason}&rdquo;
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-[0.7rem] font-medium text-accent">
                    Open check-in →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {idle.length > 0 ? (
        <section>
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            Your spaces
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {idle.map((s, i) => (
              <Link
                key={s.community_id}
                href={`/c/${s.slug}/checkin`}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/5 ${
                  i !== 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/5 text-[1.15rem]">
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatar_url}
                      alt={s.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    s.emoji
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-medium text-ink">
                    {s.name}
                  </p>
                  <p className="text-[0.7rem] text-muted">
                    {s.total_members} member
                    {s.total_members === 1 ? "" : "s"} · no active check-in
                  </p>
                </div>
                <span className="shrink-0 text-[0.7rem] font-medium text-accent">
                  Start →
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-center text-[0.7rem] text-faint">
            Only space owners can start a check-in.
          </p>
        </section>
      ) : null}
    </div>
  );
}