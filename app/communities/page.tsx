import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STARTER_IDEAS = [
  {
    emoji: "🏠",
    name: "Family group",
    slug: "family-group",
    blurb: "Keep the whole family in one place"
  },
  {
    emoji: "⛪",
    name: "Church cell",
    slug: "church-cell",
    blurb: "Your unit, your people"
  },
  {
    emoji: "🛡️",
    name: "Estate security",
    slug: "estate-security",
    blurb: "Watch each other's streets"
  },
  {
    emoji: "🎓",
    name: "Old classmates",
    slug: "old-classmates",
    blurb: "That set from way back"
  }
];

export default async function CommunitiesPage() {
  const db = createServiceClient();
  const { data: communities } = await db
    .from("communities")
    .select("id, slug, name, description, emoji, member_count, post_count")
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .limit(50);

  const list = communities ?? [];
  const isEmpty = list.length === 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-ink">
            Spaces
          </h1>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
            Your village, your game squad, your church cell, your family. Voice
            notes and text, like WhatsApp — but no phone number needed.
          </p>
        </div>
        <Link
          href="/communities/new"
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          + Create
        </Link>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="text-center">
            <div className="text-[2.5rem]">🏘️</div>
            <p className="mt-3 font-serif text-[1.2rem] font-semibold text-ink">
              No public spaces yet
            </p>
            <p className="mt-1 text-[0.875rem] text-muted">
              Be the first. Pick a starter or build your own — takes 10 seconds.
            </p>
          </div>

          <Link
            href="/communities/new"
            className="mt-5 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            👥 Create your first space
          </Link>

          <p className="mt-6 mb-2 text-center font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            Or start with an idea
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STARTER_IDEAS.map((idea) => (
              <Link
                key={idea.slug}
                href={`/communities/new?name=${encodeURIComponent(
                  idea.name
                )}&slug=${encodeURIComponent(idea.slug)}&emoji=${encodeURIComponent(
                  idea.emoji
                )}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-paper p-3 transition-colors hover:border-accent"
              >
                <span className="text-[1.5rem]">{idea.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-medium text-ink">
                    {idea.name}
                  </p>
                  <p className="truncate text-[0.7rem] text-muted">
                    {idea.blurb}
                  </p>
                </div>
                <span className="text-faint">›</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-[1.5rem]">
                {c.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-ink">
                  {c.name}
                </p>
                {c.description ? (
                  <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">
                    {c.description}
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-[0.7rem] text-faint">
                  {c.member_count} member{c.member_count === 1 ? "" : "s"} ·{" "}
                  {c.post_count} post{c.post_count === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}