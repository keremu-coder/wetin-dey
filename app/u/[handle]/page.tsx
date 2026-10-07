import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { FollowButton } from "@/components/FollowButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewedFlag } from "@/components/ReviewedFlag";
import { StatusLine } from "@/components/StatusLine";
import { StartDMButton } from "@/components/StartDMButton";
import { formatNaira } from "@/lib/constants";

export const dynamic = "force-dynamic";

const getProfileBundle = unstable_cache(
  async (handle: string) => {
    const db = createServiceClient();

    const [profileResult, postsResult] = await Promise.all([
      db
        .from("sessions")
        .select(
          "id, handle, handle_kind, bio, status_line, follower_count, following_count, post_count, verified_reporter, created_at"
        )
        .eq("handle", handle)
        .maybeSingle(),
      db
        .from("reports")
        .select(
          "id, created_at, state, reviewed, agency_canonical, agency_raw, summary_pidgin, body, status, amount_kobo"
        )
        .eq("author_handle", handle)
        .order("created_at", { ascending: false })
        .limit(30)
    ]);

    return {
      profile: profileResult.data,
      posts: (postsResult.data ?? []) as Array<{
        id: string;
        created_at: string;
        state: string;
        reviewed: boolean;
        agency_canonical: string | null;
        agency_raw: string | null;
        summary_pidgin: string | null;
        body: string | null;
        status: string;
        amount_kobo: number | null;
      }>
    };
  },
  ["profile-bundle-v2"],
  { revalidate: 60 }
);

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const colors = [
    "bg-[#C0392B]",
    "bg-[#D97706]",
    "bg-[#1F7A4D]",
    "bg-[#7C3AED]",
    "bg-[#0E7490]",
    "bg-[#BE185D]",
    "bg-[#4D7C0F]",
    "bg-[#A16207]"
  ];
  return colors[Math.abs(h) % colors.length];
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric"
  });
}

export default async function ProfilePage({
  params
}: {
  params: { handle: string };
}) {
  const handle = decodeURIComponent(params.handle);

  const [bundle, mySessionId] = await Promise.all([
    getProfileBundle(handle),
    getSessionId()
  ]);

  const profile = bundle.profile;
  const posts = bundle.posts;

  if (!profile) return notFound();

  let isFollowing = false;
  let isMe = false;
  let isSignedIn = false;

  if (mySessionId) {
    isSignedIn = true;
    isMe = mySessionId === profile.id;
    if (!isMe) {
      const db = createServiceClient();
      const { data: follow } = await db
        .from("follows")
        .select("id")
        .eq("follower_session_id", mySessionId)
        .eq("followed_session_id", profile.id)
        .maybeSingle();
      isFollowing = !!follow;
    }
  }

  const avatarLetter = handle.charAt(0).toUpperCase();
  const avatarBg = avatarColor(handle);
  const joined = new Date(profile.created_at).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric"
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${avatarBg} text-2xl font-semibold text-white shadow-sm`}
          >
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-[1.6rem] font-semibold leading-tight text-ink">
                @{handle}
              </h1>
              {profile.handle_kind === "named" ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.7rem] font-medium text-accent-deep">
                  Named
                </span>
              ) : (
                <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[0.7rem] font-medium text-faint">
                  Anonymous
                </span>
              )}
              {profile.verified_reporter ? (
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[0.7rem] font-medium text-[#6B5500]">
                  ✓ Verified reporter
                </span>
              ) : null}
            </div>

            {profile.status_line ? (
              <StatusLine
                status={profile.status_line}
                className="mt-2 !text-[0.9375rem]"
              />
            ) : null}

            <p className="mt-1 text-[0.8125rem] text-muted">
              Joined {joined}
            </p>

            <div className="mt-3 flex flex-wrap gap-5 text-[0.875rem]">
              <span>
                <strong className="font-semibold text-ink">
                  {profile.post_count ?? 0}
                </strong>{" "}
                <span className="text-muted">posts</span>
              </span>
              <Link
                href={`/u/${encodeURIComponent(handle)}/followers`}
                className="transition-colors hover:text-accent"
              >
                <strong className="font-semibold text-ink">
                  {profile.follower_count ?? 0}
                </strong>{" "}
                <span className="text-muted">followers</span>
              </Link>
              <Link
                href={`/u/${encodeURIComponent(handle)}/following`}
                className="transition-colors hover:text-accent"
              >
                <strong className="font-semibold text-ink">
                  {profile.following_count ?? 0}
                </strong>{" "}
                <span className="text-muted">following</span>
              </Link>
            </div>

            {profile.bio ? (
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink/85">
                {profile.bio}
              </p>
            ) : null}

            {!isMe ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <FollowButton
                  handle={handle}
                  initialFollowing={isFollowing}
                  initialFollowerCount={profile.follower_count ?? 0}
                />
                {isSignedIn ? <StartDMButton handle={handle} /> : null}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/settings/account"
                  className="inline-flex rounded-xl border border-border-strong bg-surface px-4 py-2 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5"
                >
                  Edit your profile
                </Link>
                <Link
                  href={`/u/${encodeURIComponent(handle)}/followers`}
                  className="inline-flex rounded-xl border border-border-strong bg-surface px-4 py-2 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5"
                >
                  See your followers
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <h2 className="mt-10 mb-4 font-serif text-[1.35rem] font-semibold text-ink">
        Posts
      </h2>

      {posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <p className="empty-state-title">No post yet</p>
          <p className="empty-state-text">
            When @{handle} posts, e go show here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((r) => {
            const title = r.agency_canonical || r.agency_raw || "Post";
            const blurb = r.summary_pidgin || r.body?.slice(0, 180) || "";
            return (
              <article
                key={r.id}
                className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[0.7rem] uppercase tracking-wide text-faint">
                      {timeAgo(r.created_at)} · {r.state}
                    </p>
                    <ReviewedFlag reviewed={r.reviewed} />
                  </div>
                  <Link href={`/r/${r.id}`} className="mt-3 block">
                    <h3 className="font-serif text-[1.2rem] font-semibold leading-tight text-ink transition-colors group-hover:text-accent">
                      {title}
                    </h3>
                  </Link>
                  <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-relaxed text-ink/85">
                    {blurb}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.amount_kobo != null ? (
                      <span className="rounded-full bg-warm-soft px-2.5 py-1 text-[0.75rem] font-medium text-warm-deep">
                        {formatNaira(r.amount_kobo)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}