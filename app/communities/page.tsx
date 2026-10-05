import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const db = createServiceClient();
  const { data: communities } = await db
    .from("communities")
    .select("id, slug, name, description, emoji, member_count, post_count")
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .limit(50);

  const list = communities ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-ink">
            Spaces
          </h1>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
            Public and private community spaces. Your village, your game squad,
            your church cell, your family.
          </p>
        </div>
        <Link
          href="/communities/new"
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          + Create
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-10 text-center">
          <div className="mb-3 text-[2rem]">🏘️</div>
          <p className="font-serif text-[1.05rem] font-semibold text-ink">
            No public spaces yet.
          </p>
          <p className="mt-2 text-[0.8125rem] text-muted">
            Be the first to create one.
          </p>
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