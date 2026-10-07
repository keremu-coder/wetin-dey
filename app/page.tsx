import Link from "next/link";
import { StatusBar } from "@/components/StatusBar";
import { StatusStrip } from "@/components/StatusStrip";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Community = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  member_count: number;
  post_count: number;
  is_public: boolean;
};

type LastMessage = {
  community_id: string;
  body: string | null;
  audio_url: string | null;
  created_at: string;
};

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

export default async function HomePage() {
  const sessionId = await getSessionId();
  const db = createServiceClient();

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
        .select("id, slug, name, emoji, member_count, post_count, is_public")
        .in("id", ids);

      spaces = (communities ?? []) as Community[];

      const { data: messages } = await db
        .from("community_messages")
        .select("community_id, body, audio_url, created_at")
        .in("community_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 5);

      for (const m of (messages ?? []) as LastMessage[]) {
        if (!lastMessages.has(m.community_id)) {
          lastMessages.set(m.community_id, m);
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
    <main className="mx-auto max-w-2xl px-4 py-4 pb-28">
      <StatusBar />
      <StatusStrip />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-[1.4rem] font-semibold leading-tight text-ink">
          Your spaces
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
                : (last.body ?? "").slice(0, 80)
              : "No messages yet";
            const time = last ? timeAgo(last.created_at) : "";

            return (
              <Link
                key={s.id}
                href={`/c/${s.slug}/chat`}
                className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-ink/5 ${
                  i !== 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink/5 text-[1.5rem]">
                  {s.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">
                      {s.name}
                    </p>
                    <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                      {time}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[0.8125rem] text-muted">
                    {preview}
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