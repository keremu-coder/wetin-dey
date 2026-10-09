import Link from "next/link";
import { StatusBar } from "@/components/StatusBar";
import { StatusStrip } from "@/components/StatusStrip";
import { getSessionId } from "@/lib/session";
import { getBlockedIds } from "@/lib/blocks";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Community = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  avatar_url: string | null;
  member_count: number;
  post_count: number;
  is_public: boolean;
};

type LastMessage = {
  community_id: string;
  body: string | null;
  audio_url: string | null;
  created_at: string;
  sender_handle: string;
};

function timeShort(date: string): string {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit"
    });
  }
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 7) {
    return d.toLocaleDateString("en-NG", { weekday: "short" });
  }
  return d.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric"
  });
}

function spaceGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const palettes = [
    "linear-gradient(135deg, #1F7A4D 0%, #14532d 100%)",
    "linear-gradient(135deg, #C0392B 0%, #7f1d1d 100%)",
    "linear-gradient(135deg, #7C3AED 0%, #4c1d95 100%)",
    "linear-gradient(135deg, #0E7490 0%, #164e63 100%)",
    "linear-gradient(135deg, #D97706 0%, #92400e 100%)",
    "linear-gradient(135deg, #BE185D 0%, #831843 100%)",
    "linear-gradient(135deg, #4D7C0F 0%, #365314 100%)",
    "linear-gradient(135deg, #A16207 0%, #713f12 100%)"
  ];
  return palettes[Math.abs(h) % palettes.length];
}

export default async function HomePage() {
  const sessionId = await getSessionId();
  const db = createServiceClient();

  const blockedIds = await getBlockedIds(sessionId);
  const blockedList = Array.from(blockedIds);

  let spaces: Community[] = [];
  const lastMessages = new Map<string, LastMessage>();

  if (sessionId) {
    const { data: memberRows } = await db
      .from("community_members")
      .select("community_id, joined_at")
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: false });

    const ids = (memberRows ?? []).map((m) => m.community_id);

    if (ids.length > 0) {
      const { data: communities } = await db
        .from("communities")
        .select(
          "id, slug, name, emoji, avatar_url, member_count, post_count, is_public"
        )
        .in("id", ids);

      spaces = (communities ?? []) as Community[];

      let messagesQ = db
        .from("community_messages")
        .select("community_id, session_id, body, audio_url, created_at")
        .eq("hidden", false)
        .in("community_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 8);

      if (blockedList.length > 0) {
        messagesQ = messagesQ.not(
          "session_id",
          "in",
          `(${blockedList.join(",")})`
        );
      }

      const { data: messages } = await messagesQ;

      const senderIds = Array.from(
        new Set((messages ?? []).map((m) => m.session_id))
      );
      const handleMap = new Map<string, string>();
      if (senderIds.length > 0) {
        const { data: sessions } = await db
          .from("sessions")
          .select("id, handle")
          .in("id", senderIds);
        for (const s of sessions ?? []) {
          handleMap.set(s.id, s.handle);
        }
      }

      for (const m of messages ?? []) {
        if (!lastMessages.has(m.community_id)) {
          lastMessages.set(m.community_id, {
            community_id: m.community_id,
            body: m.body,
            audio_url: m.audio_url,
            created_at: m.created_at,
            sender_handle: handleMap.get(m.session_id) ?? "Anonymous"
          });
        }
      }

      spaces.sort((a, b) => {
        const aTime = lastMessages.get(a.id)
          ? new Date(lastMessages.get(a.id)!.created_at).getTime()
          : 0;
        const bTime = lastMessages.get(b.id)
          ? new Date(lastMessages.get(b.id)!.created_at).getTime()
          : 0;
        return bTime - aTime;
      });
    }
  }

  const hasSpaces = spaces.length > 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-4 pb-6">
      <StatusBar />
      <StatusStrip />

      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="font-serif text-[1.4rem] font-semibold leading-tight text-ink">
          Spaces
        </h1>
        <div className="flex items-center gap-1">
          <Link
            href="/communities"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
            aria-label="Explore public spaces"
            title="Explore public spaces"
          >
            <span className="text-[1.15rem]">🧭</span>
          </Link>
          <Link
            href="/communities/new"
            className="flex h-9 items-center justify-center rounded-full bg-accent px-3.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            + New
          </Link>
        </div>
      </div>

      {!hasSpaces ? (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="text-center">
            <div className="text-[2.5rem]">💬</div>
            <p className="mt-3 font-serif text-[1.15rem] font-semibold text-ink">
              No spaces yet
            </p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
              A space is a group chat — family, church cell, estate security,
              or your friends. Like WhatsApp, but no phone number needed.
            </p>
          </div>

          <Link
            href="/communities/new"
            className="mt-5 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent px-5 font-serif text-[1.05rem] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            👥 Create your first space
          </Link>
          <Link
            href="/communities"
            className="mt-2 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-border-strong bg-surface px-5 font-serif text-[1.05rem] font-semibold text-ink transition-colors hover:bg-ink/5"
          >
            🧭 Browse public spaces
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {spaces.map((s, i) => {
            const last = lastMessages.get(s.id);
            const preview = last
              ? last.audio_url
                ? "🎤 Voice note"
                : (last.body ?? "").slice(0, 100)
              : "No messages yet";
            const time = last ? timeShort(last.created_at) : "";
            const gradient = spaceGradient(s.slug);

            return (
              <Link
                key={s.id}
                href={`/c/${s.slug}/chat`}
                className={`flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-ink/5 ${
                  i !== 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="relative shrink-0">
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatar_url}
                      alt={s.name}
                      className="h-12 w-12 rounded-full border border-border object-cover shadow-sm"
                    />
                  ) : (
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full text-[1.35rem] shadow-sm"
                      style={{ background: gradient }}
                    >
                      <span style={{ filter: "saturate(1.2)" }}>{s.emoji}</span>
                    </div>
                  )}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent ring-2 ring-surface"
                    aria-hidden
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">
                      {s.name}
                    </p>
                    <span className="shrink-0 font-mono text-[0.68rem] text-faint">
                      {time}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {last ? (
                      <span className="shrink-0 font-mono text-[0.7rem] text-muted">
                        @{last.sender_handle}:
                      </span>
                    ) : null}
                    <p className="truncate text-[0.8125rem] text-muted">
                      {preview}
                    </p>
                  </div>
                  <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                    {s.member_count} member{s.member_count === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}