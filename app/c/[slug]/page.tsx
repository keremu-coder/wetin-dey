import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { isMember } from "@/lib/community";
import { ReportCard } from "@/components/ReportCard";
import { CommunityJoinButton } from "./join-button";
import { InviteButton } from "./invite-button";

export const dynamic = "force-dynamic";

export default async function CommunityPage({
  params
}: {
  params: { slug: string };
}) {
  const db = createServiceClient();

  const { data: community } = await db
    .from("communities")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!community) return notFound();

  const sessionId = await getSessionId();
  const { member, role } = await isMember(community.id, sessionId);
  const isOwner = role === "owner";
  const canView = community.is_public || member;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link
          href="/communities"
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← All spaces
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2rem]">🔒</div>
          <p className="mt-3 font-serif text-[1.1rem] font-semibold text-ink">
            {community.name} is private
          </p>
          <p className="mt-2 text-[0.875rem] text-muted">
            Ask the owner for an invite link.
          </p>
        </div>
      </main>
    );
  }

  const { data: posts } = await db
    .from("reports")
    .select("*")
    .eq("community_id", community.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const list = posts ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <Link
        href="/communities"
        className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
      >
        ← All spaces
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink/5 text-[2rem]">
            {community.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-[1.4rem] font-semibold text-ink">
                {community.name}
              </h1>
              {!community.is_public ? (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                  Private
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 font-mono text-[0.7rem] text-faint">
              /c/{community.slug} · {community.member_count} member
              {community.member_count === 1 ? "" : "s"} ·{" "}
              {community.post_count} post
              {community.post_count === 1 ? "" : "s"}
            </p>
            {community.description ? (
              <p className="mt-3 text-[0.875rem] leading-relaxed text-ink/85">
                {community.description}
              </p>
            ) : null}
          </div>
        </div>

        {member || isOwner ? (
          <Link
            href={`/c/${community.slug}/chat`}
            className="mt-5 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-accent-deep"
          >
            💬 Enter live chat
          </Link>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CommunityJoinButton
            slug={community.slug}
            initialMember={member}
            isOwner={isOwner}
          />
          {member || community.is_public ? (
            <Link
              href={`/submit?c=${community.slug}`}
              className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-ink/5"
            >
              Write a post
            </Link>
          ) : null}
          {member || isOwner ? (
            <InviteButton
              slug={community.slug}
              name={community.name}
              emoji={community.emoji}
            />
          ) : null}
        </div>
      </div>

      <h2 className="mt-8 mb-3 font-serif text-[1.15rem] font-semibold text-ink">
        Posts in this space
      </h2>

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <p className="empty-state-title">No posts yet</p>
          <p className="empty-state-text">
            The chat is where everything happens. Tap &ldquo;Enter live
            chat&rdquo; above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <ReportCard key={r.id} report={r as never} currentHandle={null} />
          ))}
        </div>
      )}
    </main>
  );
}