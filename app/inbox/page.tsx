import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { timeAgoShort } from "@/lib/dm";

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

export default async function InboxPage() {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/signin");

  const me = await getOrCreateSessionProfile(sessionId);
  if (!me) redirect("/signin");

  const db = createServiceClient();

  const [threadsA, threadsB] = await Promise.all([
    db
      .from("dm_threads")
      .select("id, session_a, session_b, last_message_at")
      .eq("session_a", sessionId)
      .order("last_message_at", { ascending: false })
      .limit(100),
    db
      .from("dm_threads")
      .select("id, session_a, session_b, last_message_at")
      .eq("session_b", sessionId)
      .order("last_message_at", { ascending: false })
      .limit(100)
  ]);

  const threads = [...(threadsA.data ?? []), ...(threadsB.data ?? [])].sort(
    (a, b) =>
      new Date(b.last_message_at).getTime() -
      new Date(a.last_message_at).getTime()
  );

  let rows: Array<{
    id: string;
    other_handle: string;
    last_body: string | null;
    last_from_me: boolean;
    last_message_at: string;
    unread: number;
  }> = [];

  if (threads.length > 0) {
    const otherIds = threads.map((t) =>
      t.session_a === sessionId ? t.session_b : t.session_a
    );

    const threadIds = threads.map((t) => t.id);

    const [sessionsRes, messagesRes] = await Promise.all([
      db.from("sessions").select("id, handle").in("id", otherIds),
      db
        .from("dm_messages")
        .select("thread_id, sender_id, body, created_at, held, read_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(threadIds.length * 5)
    ]);

    const handleMap = new Map<string, string>();
    for (const s of sessionsRes.data ?? []) handleMap.set(s.id, s.handle);

    const lastByThread = new Map<
      string,
      { body: string; sender_id: string }
    >();
    const unreadByThread = new Map<string, number>();

    for (const m of messagesRes.data ?? []) {
      if (m.held) continue;
      if (!lastByThread.has(m.thread_id)) {
        lastByThread.set(m.thread_id, {
          body: m.body,
          sender_id: m.sender_id
        });
      }
      if (m.sender_id !== sessionId && m.read_at == null) {
        unreadByThread.set(
          m.thread_id,
          (unreadByThread.get(m.thread_id) ?? 0) + 1
        );
      }
    }

    rows = threads.map((t) => {
      const other = t.session_a === sessionId ? t.session_b : t.session_a;
      const last = lastByThread.get(t.id);
      return {
        id: t.id,
        other_handle: handleMap.get(other) ?? "Anonymous",
        last_body: last?.body ?? null,
        last_from_me: last ? last.sender_id === sessionId : false,
        last_message_at: t.last_message_at,
        unread: unreadByThread.get(t.id) ?? 0
      };
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-6">
        <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-ink">
          Inbox
        </h1>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
          Private messages. Only you and the other person can see them.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✉️</div>
          <p className="empty-state-title">No messages yet</p>
          <p className="empty-state-text">
            Open someone&apos;s profile and tap <strong>Message</strong> to
            start a conversation.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((t, i) => {
            const bg = avatarColor(t.other_handle);
            const hasUnread = t.unread > 0;
            return (
              <Link
                key={t.id}
                href={`/inbox/${t.id}`}
                className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-ink/5 ${
                  i !== 0 ? "border-t border-border" : ""
                }`}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[1rem] font-semibold text-white"
                  style={{ background: bg }}
                >
                  {t.other_handle.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`truncate text-[0.9375rem] ${
                        hasUnread
                          ? "font-bold text-ink"
                          : "font-semibold text-ink"
                      }`}
                    >
                      @{t.other_handle}
                    </p>
                    <span
                      className={`shrink-0 font-mono text-[0.65rem] ${
                        hasUnread ? "text-brand font-semibold" : "text-faint"
                      }`}
                    >
                      {timeAgoShort(t.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p
                      className={`min-w-0 flex-1 truncate text-[0.8125rem] ${
                        hasUnread ? "text-ink font-medium" : "text-muted"
                      }`}
                    >
                      {t.last_from_me ? "You: " : ""}
                      {t.last_body ?? "No messages yet"}
                    </p>
                    {hasUnread ? (
                      <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 font-mono text-[0.65rem] font-bold text-white">
                        {t.unread}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}