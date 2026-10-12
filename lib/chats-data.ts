import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/lib/blocks";
import { computePresence } from "@/lib/presence";
import { canSeePhoto } from "@/lib/photo-visibility";

export type ChatItem = {
  key: string;
  kind: "space" | "dm";
  href: string;
  name: string;
  seed: string;
  avatarUrl: string | null;
  emoji?: string | null;
  preview: string;
  previewPrefix?: string;
  voice?: boolean;
  timestamp: string;
  sortTime: number;
  unread: number;
  signal?: "ready" | "away" | "dnd" | "offline" | "live" | "quiet";
  receipt?: "sent" | "delivered" | "read";
};

export type SuggestionItem = {
  id: string;
  slug: string;
  name: string;
  emoji?: string | null;
  meta: string;
};

const TZ = "Africa/Lagos";

function timeShort(date: string): string {
  const d = new Date(date);
  const dDay = d.toLocaleDateString("en-NG", { timeZone: TZ });
  const todayDay = new Date().toLocaleDateString("en-NG", { timeZone: TZ });
  if (dDay === todayDay) {
    return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  }
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 7) return d.toLocaleDateString("en-NG", { weekday: "short", timeZone: TZ });
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric", timeZone: TZ });
}

const SIGNAL_FOR_PRESENCE: Record<string, "ready" | "away" | "dnd" | "offline"> = {
  available: "ready",
  away: "away",
  meeting: "away",
  sleeping: "away",
  driving: "dnd",
  busy: "dnd",
  offline: "offline"
};

const emptyResult = { data: [] as never[], error: null as null | { message: string } };

export async function getChatsHome(
  sessionId: string | null
): Promise<{ chats: ChatItem[]; suggestions: SuggestionItem[] }> {
  const db = createServiceClient();
  const chats: ChatItem[] = [];

  // ── ROUND 1: five independent queries, all fired at once ──
  const [blockedSet, memberRowsRes, threadsARes, threadsBRes, suggestionsRawRes] = await Promise.all([
    sessionId ? getBlockedIds(sessionId) : Promise.resolve(new Set<string>()),
    sessionId
      ? db.from("community_members").select("community_id").eq("session_id", sessionId)
      : Promise.resolve(emptyResult),
    sessionId
      ? db.from("dm_threads").select("id, session_a, session_b, last_message_at").eq("session_a", sessionId).limit(100)
      : Promise.resolve(emptyResult),
    sessionId
      ? db.from("dm_threads").select("id, session_a, session_b, last_message_at").eq("session_b", sessionId).limit(100)
      : Promise.resolve(emptyResult),
    db
      .from("communities")
      .select("id, slug, name, member_count, emoji")
      .eq("is_public", true)
      .order("member_count", { ascending: false })
      .limit(10)
  ]);

  const blockedList = Array.from(blockedSet);
  const blocked = new Set(blockedList);
  const joinedIds = ((memberRowsRes.data ?? []) as Array<{ community_id: string }>).map((m) => m.community_id);

  type ThreadRow = { id: string; session_a: string; session_b: string; last_message_at: string | null };
  const rawThreads = [...((threadsARes.data ?? []) as ThreadRow[]), ...((threadsBRes.data ?? []) as ThreadRow[])];
  const threads = rawThreads.filter((t) => !blocked.has(t.session_a === sessionId ? t.session_b : t.session_a));
  const otherIds = threads.map((t) => (t.session_a === sessionId ? t.session_b : t.session_a));
  const threadIds = threads.map((t) => t.id);

  // ── ROUND 2: five queries that depend on Round 1, all fired at once ──
  const [communitiesRes, messagesRes, readsRes, dmSessionsRes, dmMessagesRes] = await Promise.all([
    joinedIds.length > 0
      ? db.from("communities").select("id, slug, name, avatar_url, emoji").in("id", joinedIds)
      : Promise.resolve(emptyResult),
    joinedIds.length > 0
      ? (blockedList.length > 0
          ? db.from("community_messages").select("community_id, session_id, body, audio_url, created_at").eq("hidden", false).in("community_id", joinedIds).not("session_id", "in", `(${blockedList.join(",")})`).order("created_at", { ascending: false }).limit(joinedIds.length * 8)
          : db.from("community_messages").select("community_id, session_id, body, audio_url, created_at").eq("hidden", false).in("community_id", joinedIds).order("created_at", { ascending: false }).limit(joinedIds.length * 8))
      : Promise.resolve(emptyResult),
    joinedIds.length > 0 && sessionId
      ? db.from("community_reads").select("community_id, last_read_at").eq("session_id", sessionId).in("community_id", joinedIds)
      : Promise.resolve(emptyResult),
    otherIds.length > 0
      ? db.from("sessions").select("id, handle, display_name, avatar_url, availability, last_seen_at, hide_presence, photo_visibility").in("id", otherIds)
      : Promise.resolve(emptyResult),
    threadIds.length > 0
      ? db.from("dm_messages").select("thread_id, sender_id, body, created_at, held, read_at, delivered").in("thread_id", threadIds).order("created_at", { ascending: false }).limit(threadIds.length * 8)
      : Promise.resolve(emptyResult)
  ]);

  // ── ROUND 3: sender handles (needs Round 2's messages) ──
  const spaceMessages = (messagesRes.data ?? []) as Array<{ community_id: string; session_id: string; body: string | null; audio_url: string | null; created_at: string }>;
  const senderIds = Array.from(new Set(spaceMessages.map((m) => m.session_id)));
  const handlesRes = senderIds.length > 0
    ? await db.from("sessions").select("id, handle").in("id", senderIds)
    : emptyResult;
  const handleMap = new Map<string, string>();
  for (const s of (handlesRes.data ?? []) as Array<{ id: string; handle: string }>) handleMap.set(s.id, s.handle);

  // ── BUILD SPACES ──
  const lastBySpace = new Map<string, (typeof spaceMessages)[number]>();
  for (const m of spaceMessages) if (!lastBySpace.has(m.community_id)) lastBySpace.set(m.community_id, m);

  const readsTableOk = !(readsRes as { error?: unknown }).error;
  const readsMap = new Map<string, string>();
  if (readsTableOk) {
    for (const r of (readsRes.data ?? []) as Array<{ community_id: string; last_read_at: string }>) {
      readsMap.set(r.community_id, r.last_read_at);
    }
  }
  const unreadBySpace = new Map<string, number>();
  if (readsTableOk && sessionId) {
    for (const m of spaceMessages) {
      if (m.session_id === sessionId) continue;
      const readAt = readsMap.get(m.community_id);
      if (!readAt || m.created_at > readAt) {
        unreadBySpace.set(m.community_id, (unreadBySpace.get(m.community_id) ?? 0) + 1);
      }
    }
  }

  const now = Date.now();
  for (const c of (communitiesRes.data ?? []) as Array<{ id: string; slug: string; name: string; avatar_url: string | null; emoji: string | null }>) {
    const m = lastBySpace.get(c.id);
    const isLive = m ? now - new Date(m.created_at).getTime() < 15 * 60 * 1000 : false;
    chats.push({
      key: `s:${c.id}`,
      kind: "space",
      href: `/c/${c.slug}/chat`,
      name: c.name,
      seed: c.slug,
      avatarUrl: c.avatar_url ?? null,
      emoji: c.emoji ?? null,
      preview: m ? (m.audio_url ? "Voice note" : (m.body ?? "").slice(0, 100)) : "No messages yet. Say hello.",
      previewPrefix: m ? `@${handleMap.get(m.session_id) ?? "Anonymous"}: ` : undefined,
      voice: Boolean(m?.audio_url),
      timestamp: m ? timeShort(m.created_at) : "",
      sortTime: m ? new Date(m.created_at).getTime() : 0,
      unread: unreadBySpace.get(c.id) ?? 0,
      signal: isLive ? "live" : "quiet"
    });
  }

  // Follow graph for photo visibility on DM avatars
  const myFollowingSet = new Set<string>();
  if (sessionId && otherIds.length > 0) {
    const { data: followRows } = await db
      .from("follows")
      .select("followed_session_id")
      .eq("follower_session_id", sessionId)
      .in("followed_session_id", otherIds);
    for (const f of (followRows ?? []) as Array<{ followed_session_id: string }>) myFollowingSet.add(f.followed_session_id);
  }

  // ── BUILD DMs ──
  type Person = { id: string; handle: string; display_name: string | null; avatar_url: string | null; availability: string | null; last_seen_at: string | null; hide_presence: boolean | null; photo_visibility?: string | null };
  const people = new Map<string, Person>();
  for (const s of (dmSessionsRes.data ?? []) as Person[]) people.set(s.id, s);

  type DmRow = { thread_id: string; sender_id: string; body: string | null; created_at: string; held: boolean | null; read_at: string | null; delivered: boolean | null };
  const dmRows = (dmMessagesRes.data ?? []) as DmRow[];
  const lastByThread = new Map<string, DmRow>();
  const unreadByThread = new Map<string, number>();
  for (const m of dmRows) {
    if (m.held) continue;
    if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
    if (m.sender_id !== sessionId && m.read_at == null) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
    }
  }

  for (const t of threads) {
    const m = lastByThread.get(t.id);
    if (!m) continue;
    const otherId = t.session_a === sessionId ? t.session_b : t.session_a;
    const p = people.get(otherId);
    const fromMe = m.sender_id === sessionId;
    const state = computePresence(p?.availability ?? null, p?.last_seen_at ?? null);
    chats.push({
      key: `d:${t.id}`,
      kind: "dm",
      href: `/inbox/${t.id}`,
      name: p?.display_name || p?.handle || "Anonymous",
      seed: otherId,
      avatarUrl: canSeePhoto({
        viewerId: sessionId,
        targetId: otherId,
        visibility: (p?.photo_visibility as "private" | "followers" | "public" | null | undefined) ?? "private",
        isFollowing: myFollowingSet.has(otherId)
      }) ? (p?.avatar_url ?? null) : null,
      preview: (m.body ?? "").slice(0, 100),
      timestamp: timeShort(m.created_at),
      sortTime: new Date(m.created_at).getTime(),
      unread: unreadByThread.get(t.id) ?? 0,
      signal: p?.hide_presence ? "offline" : (SIGNAL_FOR_PRESENCE[state] ?? "offline"),
      receipt: fromMe ? (m.read_at ? "read" : m.delivered === false ? "sent" : "delivered") : undefined
    });
  }

  chats.sort((a, b) => b.sortTime - a.sortTime);

  // ── SUGGESTIONS ──
  const joinedSet = new Set(joinedIds);
  const suggestions: SuggestionItem[] = ((suggestionsRawRes.data ?? []) as Array<{ id: string; slug: string; name: string; member_count: number; emoji: string | null }>)
    .filter((c) => !joinedSet.has(c.id))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      emoji: c.emoji ?? null,
      meta: `${c.member_count} member${c.member_count === 1 ? "" : "s"}`
    }));

  return { chats, suggestions };
}