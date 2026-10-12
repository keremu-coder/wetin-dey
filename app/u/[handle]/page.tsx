import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { getBlockedIds } from "@/lib/blocks";
import { FollowButton } from "@/components/FollowButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewedFlag } from "@/components/ReviewedFlag";
import { StatusLine } from "@/components/StatusLine";
import { StartDMButton } from "@/components/StartDMButton";
import { ProfileActions } from "@/components/ProfileActions";
import { UnblockButton } from "@/components/UnblockButton";
import { Alama } from "@/components/Alama";
import { formatNaira } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Tab = "posts" | "followers" | "following";

type ResolvedHandle =
  | { status: "ok"; handle: string; profile_id: string }
  | { status: "redirect"; to: string }
  | { status: "none" };

const resolveHandle = unstable_cache(
  async (raw: string): Promise<ResolvedHandle> => {
    const db = createServiceClient();
    const cleaned = raw.trim().toLowerCase();

    const { data: direct } = await db
      .from("sessions")
      .select("id, handle")
      .eq("handle_lower", cleaned)
      .maybeSingle();

    if (direct?.handle) {
      return { status: "ok", handle: direct.handle, profile_id: direct.id };
    }

    const { data: candidates } = await db
      .from("sessions")
      .select("id, handle, previous_handles")
      .not("previous_handles", "is", null)
      .limit(500);

    for (const c of candidates ?? []) {
      if (!Array.isArray(c.previous_handles)) continue;
      const found = c.previous_handles.some(
        (h: unknown) => typeof h === "string" && h.toLowerCase() === cleaned
      );
      if (found && c.handle) {
        return { status: "redirect", to: c.handle };
      }
    }

    return { status: "none" };
  },
  ["resolve-handle-v2"],
  { revalidate: 300 }
);

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
        .eq("held", false)
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
  ["profile-bundle-v5"],
  { revalidate: 60 }
);

type PersonRow = {
  id: string;
  handle: string;
  status_line: string | null;
  handle_kind: string | null;
};

async function getFollowers(profileId: string): Promise<PersonRow[]> {
  const db = createServiceClient();
  const { data: followRows } = await db
    .from("follows")
    .select("follower_session_id, created_at")
    .eq("followed_session_id", profileId)
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (followRows ?? []).map((r) => r.follower_session_id);
  if (ids.length === 0) return [];

  const { data: sessions } = await db
    .from("sessions")
    .select("id, handle, status_line, handle_kind")
    .in("id", ids);

  const people = (sessions ?? []) as PersonRow[];
  const order = new Map(ids.map((id, i) => [id, i]));
  people.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return people;
}

async function getFollowing(profileId: string): Promise<PersonRow[]> {
  const db = createServiceClient();
  const { data: followRows } = await db
    .from("follows")
    .select("followed_session_id, created_at")
    .eq("follower_session_id", profileId)
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (followRows ?? []).map((r) => r.followed_session_id);
  if (ids.length === 0) return [];

  const { data: sessions } = await db
    .from("sessions")
    .select("id, handle, status_line, handle_kind")
    .in("id", ids);

  const people = (sessions ?? []) as PersonRow[];
  const order = new Map(ids.map((id, i) => [id, i]));
  people.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return people;
}

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

function avatarHex(seed: string): string {
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
  params,
  searchParams
}: {
  params: { handle: string };
  searchParams: { tab?: string };
}) {
  const requested = decodeURIComponent(params.handle).trim().toLowerCase();
  const resolved = await resolveHandle(requested);

  if (resolved.status === "none") return notFound();
  if (resolved.status === "redirect") {
    redirect(`/u/${encodeURIComponent(resolved.to)}`);
  }

  const handle = resolved.handle;

  const rawTab = (searchParams.tab ?? "posts").toLowerCase();
  const tab: Tab =
    rawTab === "followers"
      ? "followers"
      : rawTab === "following"
        ? "following"
        : "posts";

  const [bundle, mySessionId] = await Promise.all([
    getProfileBundle(handle),
    getSessionId()
  ]);

  const profile = bundle.profile;
  if (!profile) return notFound();

  // Block check — if I blocked them (or they blocked me), show a
  // blocked state instead of the profile.
  const blockedIds = await getBlockedIds(mySessionId);
  const isBlockedRelationship = blockedIds.has(profile.id);
  const isMe = mySessionId === profile.id;
  const isSignedIn = mySessionId != null;

  if (isBlockedRelationship && !isMe) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-28">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
            aria-label="Back"
          >
            ←
          </Link>
          <h1 className="truncate font-serif text-[1.15rem] font-semibold text-ink">
            @{handle}
          </h1>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2.5rem]">🚫</div>
          <p className="mt-3 font-serif text-[1.15rem] font-semibold text-ink">
            You blocked @{handle}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[0.875rem] leading-relaxed text-muted">
            You won&apos;t see their posts, comments, or messages. They can&apos;t
            see yours. If you change your mind, you can unblock them below.
          </p>
          <div className="mt-6 flex justify-center">
            <UnblockButton handle={handle} />
          </div>
        </div>
      </main>
    );
  }

  const posts = tab === "posts" ? bundle.posts : [];

  const people = await (tab === "followers"
    ? getFollowers(profile.id)
    : tab === "following"
      ? getFollowing(profile.id)
      : Promise.resolve([] as PersonRow[]));

  let myFollowSet = new Set<string>();
  if (mySessionId && people.length > 0) {
    const db = createServiceClient();
    const { data: mine } = await db
      .from("follows")
      .select("followed_session_id")
      .eq("follower_session_id", mySessionId)
      .in(
        "followed_session_id",
        people.map((p) => p.id)
      );
    myFollowSet = new Set((mine ?? []).map((f) => f.followed_session_id));
  }

  let isFollowing = false;

  if (mySessionId && !isMe) {
    const db = createServiceClient();
    const { data: follow } = await db
      .from("follows")
      .select("id")
      .eq("follower_session_id", mySessionId)
      .eq("followed_session_id", profile.id)
      .maybeSingle();
    isFollowing = !!follow;
  }

  const avatarLetter = handle.charAt(0).toUpperCase();
  const avatarBg = avatarColor(handle);
  const joined = new Date(profile.created_at).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric"
  });

  const tabs: Array<{ id: Tab; label: string; count: number; href: string }> =
    [
      {
        id: "posts",
        label: "Posts",
        count: profile.post_count ?? 0,
        href: `/u/${encodeURIComponent(handle)}`
      },
      {
        id: "followers",
        label: "Followers",
        count: profile.follower_count ?? 0,
        href: `/u/${encodeURIComponent(handle)}?tab=followers`
      },
      {
        id: "following",
        label: "Following",
        count: profile.following_count ?? 0,
        href: `/u/${encodeURIComponent(handle)}?tab=following`
      }
    ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full text-accent transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h2 className="truncate font-serif text-[1.05rem] font-semibold text-ink">
          @{handle}
        </h2>
        {isSignedIn && !isMe ? (
          <ProfileActions profileId={profile.id} handle={handle} />
        ) : (
          <Link
            href="/search"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
            aria-label="Search"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm">
            <Alama seed={profile.id} size={64} title={`@${handle}`} />
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
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.href}
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
            </Link>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === "posts" ? (
          posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p className="empty-state-title">No posts yet</p>
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
          )
        ) : people.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              {tab === "followers" ? "👥" : "👣"}
            </div>
            <p className="empty-state-title">
              {tab === "followers"
                ? isMe
                  ? "Nobody follows you yet"
                  : "No followers yet"
                : isMe
                  ? "You no follow anybody yet"
                  : "Not following anyone"}
            </p>
            <p className="empty-state-text">
              {tab === "followers"
                ? isMe
                  ? "Post something worth following."
                  : `When people follow @${handle}, they'll show here.`
                : isMe
                  ? "Find people to follow from their posts or profiles."
                  : `When @${handle} follows someone, they'll show here.`}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {people.map((p, i) => {
              const bg = avatarHex(p.handle);
              const isThisMe = mySessionId === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-start gap-3 px-4 py-3.5 ${
                    i !== 0 ? "border-t border-border" : ""
                  }`}
                >
                  <Link
                    href={`/u/${encodeURIComponent(p.handle)}`}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold text-white"
                      style={{ background: bg }}
                    >
                      {p.handle.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-medium text-ink">
                        @{p.handle}
                      </p>
                      {p.status_line ? (
                        <StatusLine
                          status={p.status_line}
                          className="mt-0.5 !text-[0.75rem]"
                        />
                      ) : p.handle_kind === "named" ? (
                        <p className="text-[0.7rem] text-muted">
                          Named account
                        </p>
                      ) : (
                        <p className="text-[0.7rem] text-muted">Anonymous</p>
                      )}
                    </div>
                  </Link>

                  {!isThisMe ? (
                    <div className="shrink-0 pt-0.5">
                      <FollowButton
                        handle={p.handle}
                        initialFollowing={myFollowSet.has(p.id)}
                        initialFollowerCount={0}
                        compact
                      />
                    </div>
                  ) : (
                    <span className="shrink-0 pt-1 text-[0.7rem] text-faint">
                      you
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}