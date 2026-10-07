"use client";

import { useState } from "react";
import Link from "next/link";

type Space = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  avatar_url: string | null;
  member_count: number;
  post_count: number;
  is_public: boolean;
  role: string;
};

type Post = {
  id: string;
  agency_canonical: string | null;
  agency_raw: string | null;
  summary_pidgin: string | null;
  body: string | null;
  created_at: string;
  post_type: string | null;
  community_id: string | null;
};

type Tab = "spaces" | "posts";

export function MeTabs({
  spaces,
  posts,
  postCount,
  initialTab
}: {
  spaces: Space[];
  posts: Post[];
  postCount: number;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  function switchTab(next: Tab) {
    setTab(next);
    // Update URL without triggering a navigation
    if (typeof window !== "undefined") {
      const url = next === "posts" ? "/me?tab=posts" : "/me";
      window.history.replaceState(null, "", url);
    }
  }

  const owned = spaces.filter((s) => s.role === "owner");
  const joined = spaces.filter((s) => s.role !== "owner");

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "spaces", label: "Spaces", count: spaces.length },
    { id: "posts", label: "Posts", count: postCount }
  ];

  return (
    <>
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 px-3 py-3 text-center transition-colors ${
                active
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <span className="font-serif text-[0.9375rem] font-semibold">
                {t.label}
              </span>
              <span className="font-mono text-[0.7rem] text-faint">
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "spaces" ? (
        <div>
          {spaces.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏘️</div>
              <p className="empty-state-title">No spaces yet</p>
              <p className="empty-state-text">
                Create a space or join one to get started.
              </p>
              <Link
                href="/communities/new"
                className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white"
              >
                Create a space
              </Link>
            </div>
          ) : (
            <>
              {owned.length > 0 ? (
                <div className="mb-4">
                  <p className="mb-2 px-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                    You own
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                    {owned.map((s, i) => (
                      <Link
                        key={s.id}
                        href={`/c/${s.slug}`}
                        className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/5 ${
                          i !== 0 ? "border-t border-border" : ""
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5 text-[1.25rem]">
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
                            {s.member_count} member
                            {s.member_count === 1 ? "" : "s"} · {s.post_count}{" "}
                            post
                            {s.post_count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="text-faint">›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {joined.length > 0 ? (
                <div>
                  <p className="mb-2 px-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                    You joined
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                    {joined.map((s, i) => (
                      <Link
                        key={s.id}
                        href={`/c/${s.slug}`}
                        className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/5 ${
                          i !== 0 ? "border-t border-border" : ""
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5 text-[1.25rem]">
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
                            {s.member_count} member
                            {s.member_count === 1 ? "" : "s"} · {s.post_count}{" "}
                            post
                            {s.post_count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="text-faint">›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div>
          {posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p className="empty-state-title">No posts yet</p>
              <p className="empty-state-text">When you post, e go show here.</p>
              <Link
                href="/submit"
                className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white"
              >
                Write a post
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => {
                const title = p.agency_canonical || p.agency_raw || "Post";
                const blurb = p.summary_pidgin || p.body?.slice(0, 120) || "";
                return (
                  <Link
                    key={p.id}
                    href={`/r/${p.id}`}
                    className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                  >
                    <p className="text-[0.9375rem] font-medium text-ink">
                      {title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">
                      {blurb}
                    </p>
                    <p className="mt-2 font-mono text-[0.65rem] text-faint">
                      {new Date(p.created_at).toLocaleDateString("en-NG", {
                        month: "short",
                        day: "numeric"
                      })}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}