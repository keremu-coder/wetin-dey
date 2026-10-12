import Link from "next/link";
import { getSessionId } from "@/lib/session";
import { getBlockedIds } from "@/lib/blocks";
import { createServiceClient } from "@/lib/supabase/server";
import { ChatRow } from "@/components/ChatRow";
import { SectionHeader } from "@/components/SectionHeader";
import { SuggestionRow } from "@/components/SuggestionRow";

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
  // Pin every date comparison and format to one timezone. Vercel runs in
  // UTC; users are in WAT (UTC+1). Without this, a message sent near
  // midnight says "Friday" on the server and "Saturday" on the phone,
  // which React flags as a hydration mismatch (errors 425/422).
  const TZ = "Africa/Lagos";
  const d = new Date(date);
  const today = new Date();
  const dDay = d.toLocaleDateString("en-NG", { timeZone: TZ });
  const todayDay = today.toLocaleDateString("en-NG", { timeZone: TZ });
  if (dDay === todayDay) {
    return d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: TZ
    });
  }
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 7) {
    return d.toLocaleDateString("en-NG", {
      weekday: "short",
      timeZone: TZ
    });
  }
  return d.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    timeZone: TZ
  });
}

export default async function HomePage() {
  const sessionId = await getSessionId();
  const db = createServiceClient();

  const blockedIds = await getBlockedIds(sessionId);
  const blockedList = Array.from(blockedIds);

  let spaces: Community[] = [];
  let memberIds: string[] = [];
  const lastMessages = new Map<string, LastMessage>();

  if (sessionId) {
    const { data: memberRows } = await db
      .from("community_members")
      .select("community_id, joined_at")
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: false });

    memberIds = (memberRows ?? []).map((m) => m.community_id);

    if (memberIds.length > 0) {
      const { data: communities } = await db
        .from("communities")
        .select(
          "id, slug, name, emoji, avatar_url, member_count, post_count, is_public"
        )
        .in("id", memberIds);

      spaces = (communities ?? []) as Community[];

      let messagesQ = db
        .from("community_messages")
        .select("community_id, session_id, body, audio_url, created_at")
        .eq("hidden", false)
        .in("community_id", memberIds)
        .order("created_at", { ascending: false })
        .limit(memberIds.length * 8);

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

  // Suggested spaces — public, not already a member of, sorted by popularity.
  // Fills the page for users who've only joined one or two spaces. Same idea
  // as Instagram's "Suggested for you".
  let suggestedSpaces: Community[] = [];
  const { data: candidates } = await db
    .from("communities")
    .select(
      "id, slug, name, emoji, avatar_url, member_count, post_count, is_public"
    )
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .limit(30);

  if (candidates) {
    const memberSet = new Set(memberIds);
    suggestedSpaces = (candidates as Community[])
      .filter((c) => !memberSet.has(c.id))
      .slice(0, 3);
  }

  // Show suggestions even for users with zero memberships — this is the
  // fix for Apple 4.2.2 (empty first screen). A new user must see real
  // spaces they can join, not just a "No spaces yet" card.
  const showSuggested = suggestedSpaces.length > 0;

  return (
    <main className="mx-auto max-w-2xl pb-24">
      <div className="px-5 pb-3 pt-2">
        <Link
          href="/search"
          className="flex h-12 items-center gap-3 rounded-3xl bg-surface2 px-4 text-[1rem] leading-[1.5rem] text-muted"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Search spaces and people</span>
        </Link>
      </div>

      {hasSpaces ? (
        <>
          <SectionHeader
            title="Chats"
            action={{ label: "New space", href: "/communities/new" }}
          />
          <div>
            {spaces.map((s, i) => {
              const last = lastMessages.get(s.id);
              const preview = last
                ? last.audio_url
                  ? "Voice note"
                  : (last.body ?? "").slice(0, 100)
                : "No messages yet. Say hello.";
              const time = last ? timeShort(last.created_at) : "";
              const prefix = last ? `@${last.sender_handle}: ` : undefined;
              return (
                <ChatRow
                  key={s.id}
                  href={`/c/${s.slug}/chat`}
                  name={s.name}
                  seed={s.slug}
                  avatarUrl={s.avatar_url}
                  preview={preview}
                  previewPrefix={prefix}
                  timestamp={time}
                  isLast={i === spaces.length - 1}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-[280px] px-5 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-3xl bg-primary-tint">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary-ink" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-[1.0625rem] font-semibold leading-[1.375rem] text-ink">
            Your people dey here
          </p>
          <p className="mt-2 text-[1rem] leading-[1.5rem] text-muted">
            Join a space or start one for your family, church cell, estate or friends. Send voice notes, share news, no phone number needed.
          </p>
          <Link
            href="/communities/new"
            className="mt-6 flex h-12 items-center justify-center rounded-full bg-primary px-6 text-[1rem] font-semibold text-white"
          >
            Start a space
          </Link>
          <Link
            href="/join"
            className="mt-2 flex h-11 items-center justify-center text-[0.9375rem] font-semibold text-primary-ink"
          >
            I have an invite link
          </Link>
        </div>
      )}

      {showSuggested ? (
        <>
          <SectionHeader title="Spaces you might like" />
          <div>
            {suggestedSpaces.map((s, i) => (
              <SuggestionRow
                key={s.id}
                href={`/c/${s.slug}`}
                name={s.name}
                seed={s.slug}
                meta={`${s.member_count} member${s.member_count === 1 ? "" : "s"}`}
                isLast={i === suggestedSpaces.length - 1}
              />
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}