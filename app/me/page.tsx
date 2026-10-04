import Link from "next/link";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { ReviewedFlag } from "@/components/ReviewedFlag";
import { StatusBadge } from "@/components/StatusBadge";
import { formatNaira } from "@/lib/constants";

export const dynamic = "force-dynamic";

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
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

export default async function MePage({
  searchParams
}: {
  searchParams: { joined?: string };
}) {
  const sessionId = await getSessionId();

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-serif text-3xl font-semibold text-ink">You no get session</h1>
        <p className="mt-3 text-muted">
          Go home first, submit or browse small, then come back.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-warm px-5 py-3 font-medium text-white"
        >
          Go home
        </Link>
      </main>
    );
  }

  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted">Profile no load. Try again.</p>
      </main>
    );
  }

  const db = createServiceClient();
  const { data: posts } = await db
    .from("reports")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);

  const isNamed = profile.handle_kind === "named";
  const justJoined = searchParams.joined === "1";
  const avatarLetter = profile.handle.charAt(0).toUpperCase();
  const avatarBg = avatarColor(profile.handle);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {/* ─── success banner when just joined ─── */}
      {justJoined ? (
        <div className="mb-6 rounded-2xl border border-accent/25 bg-accent-soft/70 p-4 fade-in">
          <p className="text-[0.9375rem] font-medium text-accent-deep">
            🎉 You dey inside. Welcome to Wetin Dey.
          </p>
          <p className="mt-1 text-[0.8125rem] text-accent-deep/80">
            Your handle na <span className="font-semibold">@{profile.handle}</span>. People fit
            follow you now.
          </p>
        </div>
      ) : null}

      {/* ─── profile header ─── */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${avatarBg} font-serif text-2xl font-semibold text-white shadow-sm`}
          >
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-2xl font-semibold text-ink">
                @{profile.handle}
              </h1>
              {isNamed ? (
                <span className="rounded-full bg-warm-soft px-2 py-0.5 text-[0.7rem] font-medium text-warm-deep">
                  Named
                </span>
              ) : (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[0.7rem] font-medium text-muted">
                  Anonymous
                </span>
              )}
            </div>
            <p className="mt-1 text-[0.8125rem] text-muted">
              {isNamed
                ? `You join ${new Date(profile.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}`
                : "You never sign up. You still dey anonymous."}
            </p>

            {/* stats */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem]">
              <span className="text-ink">
                <strong className="font-semibold">{profile.follower_count}</strong>{" "}
                <span className="text-muted">followers</span>
              </span>
              <span className="text-ink">
                <strong className="font-semibold">{profile.following_count}</strong>{" "}
                <span className="text-muted">following</span>
              </span>
              <span className="text-ink">
                <strong className="font-semibold">{posts?.length ?? 0}</strong>{" "}
                <span className="text-muted">posts</span>
              </span>
            </div>
          </div>
        </div>

        {/* upgrade / account actions */}
        {!isNamed ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-[0.875rem] text-muted">
              Want make people fit follow you and see your name on posts?
            </p>
            <Link
              href="/join"
              className="mt-3 inline-block rounded-xl bg-warm px-4 py-2.5 text-[0.875rem] font-medium text-white transition-all hover:bg-warm-deep"
            >
              Claim your handle
            </Link>
          </div>
        ) : (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-[0.8125rem] text-muted">
              You dey signed in as <span className="font-medium text-ink">{profile.email}</span>
            </p>
          </div>
        )}
      </div>

      {/* ─── posts ─── */}
      <div className="mt-8">
        <h2 className="font-serif text-xl font-semibold text-ink">Your posts</h2>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Everything you don post from this browser.
        </p>

        {!posts || posts.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-strong bg-surface/50 p-8 text-center">
            <p className="font-serif text-base text-ink">You never post anything.</p>
            <Link
              href="/submit"
              className="mt-3 inline-block rounded-xl bg-warm px-4 py-2 text-[0.8125rem] font-medium text-white"
            >
              Talk Am
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {posts.map((p) => {
              const title = p.agency_canonical || p.agency_raw;
              const blurb = p.summary_pidgin || p.body.slice(0, 140);
              return (
                <Link
                  key={p.id}
                  href={`/r/${p.id}`}
                  className="block rounded-2xl border border-border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={p.status} />
                        <span className="font-mono text-[0.7rem] uppercase tracking-wide text-faint">
                          {timeAgo(p.created_at)}
                        </span>
                      </div>
                      <h3 className="mt-2 font-serif text-lg font-semibold text-ink">
                        {title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[0.875rem] leading-relaxed text-ink/80">
                        {blurb}
                      </p>
                      {p.amount_kobo != null ? (
                        <p className="mt-2 font-mono text-[0.75rem] text-warm-deep">
                          {formatNaira(p.amount_kobo)}
                        </p>
                      ) : null}
                    </div>
                    <ReviewedFlag reviewed={p.reviewed} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-[0.75rem] text-faint">
        No profile. No name — unless you choose one. If you clear cookies, this list disappears.
      </p>
    </main>
  );
}