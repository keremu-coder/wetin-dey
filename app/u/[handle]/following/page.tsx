import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId } from "@/lib/session";
import { FollowButton } from "@/components/FollowButton";
import { StatusLine } from "@/components/StatusLine";

export const dynamic = "force-dynamic";

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

type Row = {
  id: string;
  handle: string;
  status_line: string | null;
  handle_kind: string | null;
};

export default async function FollowingPage({
  params
}: {
  params: { handle: string };
}) {
  const handle = decodeURIComponent(params.handle);
  const db = createServiceClient();

  const { data: profile } = await db
    .from("sessions")
    .select("id, handle, following_count")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) return notFound();

  const mySessionId = await getSessionId();
  const isMe = mySessionId === profile.id;

  // Who does this profile follow?
  const { data: followRows } = await db
    .from("follows")
    .select("followed_session_id, created_at")
    .eq("follower_session_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const followedIds = (followRows ?? []).map((r) => r.followed_session_id);

  let people: Row[] = [];
  if (followedIds.length > 0) {
    const { data: sessions } = await db
      .from("sessions")
      .select("id, handle, status_line, handle_kind")
      .in("id", followedIds);
    people = (sessions ?? []) as Row[];
    const order = new Map(followedIds.map((id, i) => [id, i]));
    people.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );
  }

  // Who am I following among these people? (so we know to show "Following")
  let myFollowing = new Set<string>();
  if (mySessionId && people.length > 0) {
    const { data: myFollows } = await db
      .from("follows")
      .select("followed_session_id")
      .eq("follower_session_id", mySessionId)
      .in(
        "followed_session_id",
        people.map((p) => p.id)
      );
    myFollowing = new Set(
      (myFollows ?? []).map((f) => f.followed_session_id)
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <Link
        href={`/u/${encodeURIComponent(handle)}`}
        className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
      >
        ← @{handle}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Following
        </h1>
        <p className="mt-1 text-[0.8125rem] text-muted">
          {profile.following_count ?? 0}{" "}
          {isMe ? "people you follow" : `people @${handle} follows`}
        </p>
      </div>

      {people.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👣</div>
          <p className="empty-state-title">
            {isMe ? "You no follow anybody yet" : "Not following anyone"}
          </p>
          <p className="empty-state-text">
            {isMe
              ? "Find people to follow from their posts or profiles."
              : `When @${handle} follows someone, they'll show here.`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {people.map((p, i) => {
            const bg = avatarColor(p.handle);
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
                      <p className="text-[0.7rem] text-muted">Named account</p>
                    ) : (
                      <p className="text-[0.7rem] text-muted">Anonymous</p>
                    )}
                  </div>
                </Link>

                {!isThisMe ? (
                  <div className="shrink-0 pt-0.5">
                    <FollowButton
                      handle={p.handle}
                      initialFollowing={myFollowing.has(p.id)}
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
    </main>
  );
}