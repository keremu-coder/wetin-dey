import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/lib/blocks";
import { computePresence } from "@/lib/presence";

export type ChatItem = {
  key: string;
  kind: "space" | "dm";
  href: string;
  name: string;
  seed: string;
  avatarUrl: string | null;
  preview: string;
  previewPrefix?: string;
  voice?: boolean;
  timestamp: string;
  sortTime: number;
  unread: number;
  presenceColor?: string;
  receipt?: "sent" | "delivered" | "read";
};

export type SuggestionItem = { id: string; slug: string; name: string; meta: string };

type Db = ReturnType<typeof createServiceClient>;

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

// Presence colours from the v3 tokens. No red: red means danger only.
const PRESENCE_COLOR: Record<string, string | undefined> = {
  available: "var(--color-accent)",
  away: "var(--color-warn)",
  meeting: "var(--color-warn)",
  driving: "var(--color-adire)",
  busy: "var(--color-clay)",
  sleeping: "var(--color-plum)",
  offline: undefined
};

async function spaceUnread(db: Db, sessionId: string, ids: string[], blocked: string[]) {
  const out = new Map<string, number>();
  const { data: reads, error } = await db
    .from("community_reads")
    .select("community_id, last_read_at")
    .eq("session_id", sessionId)
    .in("community_id", ids);
  if (error) return out; // table not migrated yet: no pills, no crash

  const readAt = new Map<string, string>(
    (reads ?? []).map((r) => [r.community_id as string, r.last_read_at as string])
  );
  const fresh = ids.filter((id) => !readAt.has(id));
  if (fresh.length > 0) {
    // First time we see you in a space: start counting from now.
    await db.from("community_reads").upsert(
      fresh.map((id) => ({ session_id: sessionId, community_id: id, last_read_at: new Date().toISOString() })),
      { onConflict: "session_id,community_id", ignoreDuplicates: true }
    );
  }
  await Promise.all(
    ids.filter((id) => readAt.has(id)).map(async (id) => {
      let q = db
        .from("community_messages")
        .select("id", { count: "exact", head: true })
        .eq("community_id", id)
        .eq("hidden", false)
        .neq("session_id", sessionId)
        .gt("created_at", readAt.get(id)!);
      if (blocked.length > 0) q = q.not("session_id", "in", `(${blocked.join(",")})`);
      const { count } = await q;
      if (count) out.set(id, count);
    })
  );
  return out;
}

export async function getChatsHome(
  sessionId: string | null
): Promise<{ chats: ChatItem[]; suggestions: SuggestionItem[] }> {
  const db = createServiceClient();
  const chats: ChatItem[] = [];
  let joinedIds: string[] = [];

  try {
    if (sessionId) {
      const blockedList = Array.from(await getBlockedIds(sessionId));

      // ── Spaces ──
      const { data: memberRows } = await db
        .from("community_members").select("community_id").eq("session_id", sessionId);
      joinedIds = (memberRows ?? []).map((m) => m.community_id as string);

      if (joinedIds.length > 0) {
        const { data: communities } = await db
          .from("communities").select("id, slug, name, avatar_url").in("id", joinedIds);

        let mq = db
          .from("community_messages")
          .select("community_id, session_id, body, audio_url, created_at")
          .eq("hidden", false)
          .in("community_id", joinedIds)
          .order("created_at", { ascending: false })
          .limit(joinedIds.length * 8);
        if (blockedList.length > 0) mq = mq.not("session_id", "in", `(${blockedList.join(",")})`);
        const { data: messages } = await mq;

        const senderIds = Array.from(new Set((messages ?? []).map((m) => m.session_id as string)));
        const handles = new Map<string, string>();
        if (senderIds.length > 0) {
          const { data: ss } = await db.from("sessions").select("id, handle").in("id", senderIds);
          for (const s of ss ?? []) handles.set(s.id, s.handle);
        }
        const last = new Map<string, NonNullable<typeof messages>[number]>();
        for (const m of messages ?? []) if (!last.has(m.community_id)) last.set(m.community_id, m);

        const unreadBy = await spaceUnread(db, sessionId, (communities ?? []).map((c) => c.id as string), blockedList);

        for (const c of communities ?? []) {
          const m = last.get(c.id);
          chats.push({
            key: `s:${c.id}`,
            kind: "space",
            href: `/c/${c.slug}/chat`,
            name: c.name,
            seed: c.slug,
            avatarUrl: c.avatar_url ?? null,
            preview: m ? (m.audio_url ? "Voice note" : (m.body ?? "").slice(0, 100)) : "No messages yet. Say hello.",
            previewPrefix: m ? `@${handles.get(m.session_id) ?? "Anonymous"}: ` : undefined,
            voice: !!m?.audio_url,
            timestamp: m ? timeShort(m.created_at) : "",
            sortTime: m ? new Date(m.created_at).getTime() : 0,
            unread: unreadBy.get(c.id) ?? 0
          });
        }
      }

      // ── Direct messages (people) ──
      const [ta, tb] = await Promise.all([
        db.from("dm_threads").select("id, session_a, session_b, last_message_at").eq("session_a", sessionId).limit(100),
        db.from("dm_threads").select("id, session_a, session_b, last_message_at").eq("session_b", sessionId).limit(100)
      ]);
      const blocked = new Set(blockedList);
      const threads = [...(ta.data ?? []), ...(tb.data ?? [])].filter((t) => {
        const other = t.session_a === sessionId ? t.session_b : t.session_a;
        return !blocked.has(other);
      });

      if (threads.length > 0) {
        const otherIds = threads.map((t) => (t.session_a === sessionId ? t.session_b : t.session_a) as string);
        const threadIds = threads.map((t) => t.id as string);
        const [sRes, mRes] = await Promise.all([
          db.from("sessions")
            .select("id, handle, display_name, avatar_url, availability, last_seen_at, hide_presence")
            .in("id", otherIds),
          db.from("dm_messages")
            .select("thread_id, sender_id, body, created_at, held, read_at, delivered")
            .in("thread_id", threadIds)
            .order("created_at", { ascending: false })
            .limit(threadIds.length * 8)
        ]);

        const people = new Map<string, NonNullable<typeof sRes.data>[number]>();
        for (const s of sRes.data ?? []) people.set(s.id, s);

        const lastBy = new Map<string, NonNullable<typeof mRes.data>[number]>();
        const unreadBy = new Map<string, number>();
        for (const m of mRes.data ?? []) {
          if (m.held) continue;
          if (!lastBy.has(m.thread_id)) lastBy.set(m.thread_id, m);
          if (m.sender_id !== sessionId && m.read_at == null) {
            unreadBy.set(m.thread_id, (unreadBy.get(m.thread_id) ?? 0) + 1);
          }
        }

        for (const t of threads) {
          const m = lastBy.get(t.id);
          if (!m) continue;
          const otherId = t.session_a === sessionId ? t.session_b : t.session_a;
          const p = people.get(otherId);
          const fromMe = m.sender_id === sessionId;
          const state = computePresence(p?.availability, p?.last_seen_at);
          chats.push({
            key: `d:${t.id}`,
            kind: "dm",
            href: `/inbox/${t.id}`,
            name: p?.display_name || p?.handle || "Anonymous",
            seed: otherId,
            avatarUrl: p?.avatar_url ?? null,
            preview: (m.body ?? "").slice(0, 100),
            timestamp: timeShort(m.created_at),
            sortTime: new Date(m.created_at).getTime(),
            unread: unreadBy.get(t.id) ?? 0,
            presenceColor: p?.hide_presence ? undefined : PRESENCE_COLOR[state],
            receipt: fromMe ? (m.read_at ? "read" : m.delivered === false ? "sent" : "delivered") : undefined
          });
        }
      }
    }
  } catch (e) {
    console.error("[chats-data] chats failed:", (e as Error).message);
  }

  // ── Suggestions: popular public spaces you have not joined ──
  let suggestions: SuggestionItem[] = [];
  try {
    let sq = db
      .from("communities")
      .select("id, slug, name, member_count")
      .eq("is_public", true)
      .order("member_count", { ascending: false })
      .limit(3);
    if (joinedIds.length > 0) sq = sq.not("id", "in", `(${joinedIds.join(",")})`);
    const { data } = await sq;
    suggestions = (data ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      meta: `${c.member_count} member${c.member_count === 1 ? "" : "s"}`
    }));
  } catch (e) {
    console.error("[chats-data] suggestions failed:", (e as Error).message);
  }

  chats.sort((a, b) => b.sortTime - a.sortTime);
  return { chats, suggestions };
}