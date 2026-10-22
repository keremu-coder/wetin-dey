import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { isMember } from "@/lib/community";
import type { MessageParent } from "@/lib/chat";
import { canSeePhoto } from "@/lib/photo-visibility";
import { ChatRoom } from "./ChatRoom";

export const dynamic = "force-dynamic";

export default async function ChatPage(props: {
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
  const canView = community.is_public || member;

  if (!canView) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link href={`/c/${community.slug}`} className="text-[0.7rem] text-faint hover:text-brand">
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

  const myProfile = sessionId ? await getOrCreateSessionProfile(sessionId) : null;

  const [messagesRes, membersRes] = await Promise.all([
    db
      .from("community_messages")
      .select("id, session_id, body, audio_url, created_at, parent_id")
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

  const parentIds = Array.from(
    new Set(
      rawMessages
        .map((m) => m.parent_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  type ParentRow = {
    id: string;
    session_id: string;
    body: string | null;
    audio_url: string | null;
  };

  let parentRows: ParentRow[] = [];
  if (parentIds.length > 0) {
    const { data } = await db
      .from("community_messages")
      .select("id, session_id, body, audio_url")
      .in("id", parentIds);
    parentRows = (data ?? []) as ParentRow[];
  }

  const allSessionIds = Array.from(
    new Set([
      ...(sessionId ? [sessionId] : []),
      ...rawMessages.map((m) => m.session_id),
      ...memberRows.map((m) => m.session_id),
      ...parentRows.map((p) => p.session_id)
    ])
  ).filter(Boolean);

  const profilesMap = new Map<
    string,
    {
      handle: string;
      avatar_url: string | null;
      photo_visibility: string | null;
      last_seen_at: string | null;
      hide_presence: boolean;
      font_preference: string | null;
      text_color: string | null;
      status_line: string | null;
    }
  >();

  const myFollowingSet = new Set<string>();

  if (allSessionIds.length > 0) {
    const [{ data: profiles }, { data: followRows }] = await Promise.all([
      db
        .from("sessions")
        .select("id, handle, avatar_url, photo_visibility, last_seen_at, hide_presence, font_preference, text_color, status_line")
        .in("id", allSessionIds),
      sessionId
        ? db
            .from("follows")
            .select("followed_session_id")
            .eq("follower_session_id", sessionId)
            .in("followed_session_id", allSessionIds)
        : Promise.resolve({ data: [] })
    ]);

    for (const f of (followRows ?? []) as Array<{ followed_session_id: string }>) {
      myFollowingSet.add(f.followed_session_id);
    }

    for (const p of profiles ?? []) {
      profilesMap.set(p.id, {
        handle: p.handle,
        avatar_url: p.avatar_url ?? null,
        photo_visibility: p.photo_visibility ?? "private",
        last_seen_at: p.last_seen_at ?? null,
        hide_presence: p.hide_presence === true,
        font_preference: p.font_preference ?? null,
        text_color: p.text_color ?? null,
        status_line: p.status_line ?? null
      });
    }
  }

  const requesterHides = sessionId
    ? (profilesMap.get(sessionId)?.hide_presence ?? false)
    : false;

  const avatarMap = new Map<string, string | null>();
  for (const [id, p] of profilesMap.entries()) {
    const canSee = canSeePhoto({
      viewerId: sessionId,
      targetId: id,
      visibility: p.photo_visibility as any,
      isFollowing: myFollowingSet.has(id)
    });
    avatarMap.set(id, canSee ? p.avatar_url : null);
  }

  const parentMap = new Map<string, MessageParent>();
  for (const p of parentRows) {
    parentMap.set(p.id, {
      id: p.id,
      author_handle: profilesMap.get(p.session_id)?.handle ?? "Anonymous",
      author_avatar_url: avatarMap.get(p.session_id) ?? null,
      body: p.body,
      audio_url: p.audio_url
    });
  }

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

  const initialMessages = rawMessages.map((m) => {
    const p = profilesMap.get(m.session_id);
    const parentId = m.parent_id ?? null;
    return {
      id: m.id,
      body: m.body,
      audio_url: m.audio_url,
      created_at: m.created_at,
      author_handle: p?.handle ?? "Anonymous",
      author_avatar_url: avatarMap.get(m.session_id) ?? null,
      author_last_seen:
        (requesterHides || p?.hide_presence === true)
          ? null
          : (p?.last_seen_at ?? null),
      reactions: reactionMap.get(m.id) ?? [],
      parent_id: parentId,
      parent: parentId ? parentMap.get(parentId) ?? null : null
    };
  });

  const initialMembers = memberRows.map((m) => {
    const p = profilesMap.get(m.session_id);
    return {
      session_id: m.session_id,
      handle: p?.handle ?? "Anonymous",
      avatar_url: avatarMap.get(m.session_id) ?? null,
      last_seen_at:
        (requesterHides || p?.hide_presence === true)
          ? null
          : (p?.last_seen_at ?? null),
      role: m.role
    };
  });

  const initialFonts: Record<string, string> = {};
  const initialColors: Record<string, string> = {};
  const initialStatuses: Record<string, string> = {};
  for (const [id, p] of profilesMap.entries()) {
    if (p.font_preference) initialFonts[p.handle] = p.font_preference;
    if (p.text_color) initialColors[p.handle] = p.text_color;
    if (p.status_line) initialStatuses[p.handle] = p.status_line;
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
      initialColors={initialColors}
      initialStatuses={initialStatuses}
    />
  );
}
