import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { isMember } from "@/lib/community";
import { ChatRoom } from "./ChatRoom";

export const dynamic = "force-dynamic";

export default async function ChatPage({
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
          href={`/c/${community.slug}`}
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← Back to space
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2rem]">🔒</div>
          <p className="mt-3 font-serif text-[1.1rem] font-semibold text-ink">
            {community.name} is private
          </p>
          <p className="mt-2 text-[0.875rem] text-muted">
            Only members can enter the chat.
          </p>
        </div>
      </main>
    );
  }

  // ─── Server-fetch everything ChatRoom used to fetch on mount ───
  const myProfile = sessionId
    ? await getOrCreateSessionProfile(sessionId)
    : null;

  // Fetch messages, members, and their profiles in parallel
  const [messagesRes, membersRes] = await Promise.all([
    db
      .from("community_messages")
      .select("id, session_id, body, audio_url, created_at")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("community_members")
      .select("session_id, role")
      .eq("community_id", community.id)
  ]);

  const rawMessages = (messagesRes.data ?? []).reverse();
  const memberRows = membersRes.data ?? [];

  // Unique session ids from both messages and members
  const allSessionIds = Array.from(
    new Set([
      ...rawMessages.map((m) => m.session_id),
      ...memberRows.map((m) => m.session_id)
    ])
  ).filter(Boolean);

  // Fetch handles, last_seen, fonts, statuses in one query
  const profilesMap = new Map<
    string,
    {
      handle: string;
      last_seen_at: string | null;
      font_preference: string | null;
      status_line: string | null;
    }
  >();

  if (allSessionIds.length > 0) {
    const { data: profiles } = await db
      .from("sessions")
      .select("id, handle, last_seen_at, font_preference, status_line")
      .in("id", allSessionIds);

    for (const p of profiles ?? []) {
      profilesMap.set(p.id, {
        handle: p.handle,
        last_seen_at: p.last_seen_at ?? null,
        font_preference: p.font_preference ?? null,
        status_line: p.status_line ?? null
      });
    }
  }

  // Reactions for the messages
  const msgIds = rawMessages.map((m) => m.id);
  const reactionMap = new Map<string, { emoji: string; count: number }[]>();
  if (msgIds.length > 0) {
    const { data: reactions } = await db
      .from("message_reactions")
      .select("message_id, emoji")
      .in("message_id", msgIds);

    for (const r of reactions ?? []) {
      const list = reactionMap.get(r.message_id) ?? [];
      const existing = list.find((x) => x.emoji === r.emoji);
      if (existing) existing.count += 1;
      else list.push({ emoji: r.emoji, count: 1 });
      reactionMap.set(r.message_id, list);
    }
  }

  // Build the initial messages array exactly like ChatRoom expects
  const initialMessages = rawMessages.map((m) => {
    const p = profilesMap.get(m.session_id);
    return {
      id: m.id,
      body: m.body,
      audio_url: m.audio_url,
      created_at: m.created_at,
      author_handle: p?.handle ?? "Anonymous",
      author_last_seen: p?.last_seen_at ?? null,
      reactions: reactionMap.get(m.id) ?? []
    };
  });

  // Build initial members array
  const initialMembers = memberRows.map((m) => {
    const p = profilesMap.get(m.session_id);
    return {
      session_id: m.session_id,
      handle: p?.handle ?? "Anonymous",
      last_seen_at: p?.last_seen_at ?? null,
      role: m.role
    };
  });

  // Build font + status maps so ChatRoom doesn't fetch them
  const initialFonts: Record<string, string> = {};
  const initialStatuses: Record<string, string> = {};
  for (const [id, p] of profilesMap.entries()) {
    if (p.font_preference) {
      initialFonts[p.handle] = p.font_preference;
    }
    if (p.status_line) {
      initialStatuses[p.handle] = p.status_line;
    }
  }

  return (
    <ChatRoom
      slug={community.slug}
      name={community.name}
      emoji={community.emoji}
      avatarUrl={community.avatar_url ?? null}
      isMember={member || isOwner}
      isOwner={isOwner}
      initialMessages={initialMessages}
      initialMembers={initialMembers}
      initialMe={myProfile?.handle ?? null}
      initialMySessionId={sessionId ?? null}
      initialFonts={initialFonts}
      initialStatuses={initialStatuses}
    />
  );
}