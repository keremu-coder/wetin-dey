import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { isMember } from "@/lib/community";
import { ReportCard } from "@/components/ReportCard";
import { SpaceAvatarUploader } from "@/components/SpaceAvatarUploader";
import { CommunityActions } from "@/components/CommunityActions";
import { CommunityJoinButton } from "./join-button";
import { InviteButton } from "./invite-button";

export const dynamic = "force-dynamic";

export default async function CommunityPage(props: {

    params: Promise<{ slug: string }>;

}) {
  const params = await props.params;

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

  // Private space, visitor is not a member: show a join screen.
  if (!member && !isOwner && !community.is_public) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link
          href="/communities"
          className="text-[0.7rem] text-faint hover:text-brand"
        >
          ← All spaces
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          {community.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.avatar_url}
              alt={community.name}
              className="mx-auto h-20 w-20 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="text-[3rem]">{community.emoji}</div>
          )}

          <p className="mt-4 font-serif text-[1.35rem] font-semibold text-ink">
            {community.name}
          </p>

          <p className="mt-1 text-[0.7rem] text-faint">
            🔒 Private space
          </p>

          {community.description ? (
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
              {community.description}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col items-center gap-3">
            <CommunityJoinButton
              slug={community.slug}
              initialMember={false}
              isOwner={false}
            />
            <p className="text-[0.75rem] text-faint">
              Someone shared this link with you. Tap Join to enter.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const nowIso = new Date().toISOString();
  const { data: activeCheckin } = await db
    .from("checkin_requests")
    .select("id, reason")
    .eq("community_id", community.id)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
        className="text-[0.7rem] text-faint hover:text-brand"
      >
        ← All spaces
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          {community.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.avatar_url}
              alt={community.name}
              className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink/5 text-[2rem]">
              {community.emoji}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-[1.4rem] font-semibold text-ink">
                {community.name}
              </h1>
              {!community.is_public ? (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[0.65rem] text-faint">
                  Private
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[0.7rem] text-faint">
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
          {!isOwner ? (
            <CommunityActions
              communityId={community.id}
              communityName={community.name}
            />
          ) : null}
        </div>

        {isOwner ? (
          <div className="mt-5 border-t border-border pt-4">
            <SpaceAvatarUploader
              slug={community.slug}
              currentAvatarUrl={community.avatar_url ?? null}
            />
          </div>
        ) : null}

        {member || isOwner ? (
          <Link
            href={`/c/${community.slug}/chat`}
            className="mt-5 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-brand px-5 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-brand-soft"
          >
            💬 Enter live chat
          </Link>
        ) : null}

        {activeCheckin ? (
          <Link
            href={`/c/${community.slug}/checkin`}
            className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-gold/50 bg-gold-soft/50 p-3.5 transition-colors hover:border-gold"
          >
            <span className="text-[1.4rem]">🔔</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] font-semibold text-ink">
                Check-in in progress
              </p>
              <p className="truncate text-[0.75rem] text-ink/70">
                {activeCheckin.reason
                  ? activeCheckin.reason
                  : "Tap to reply I'm safe / I need help"}
              </p>
            </div>
            <span className="text-faint">›</span>
          </Link>
        ) : (
          <Link
            href={`/c/${community.slug}/checkin`}
            className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-paper p-3.5 transition-colors hover:border-brand"
          >
            <span className="text-[1.4rem]">🛡️</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] font-semibold text-ink">
                Family check-in
              </p>
              <p className="truncate text-[0.75rem] text-muted">
                Private rollcall — are you safe?
              </p>
            </div>
            <span className="text-faint">›</span>
          </Link>
        )}

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