"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { timeAgoShort } from "@/lib/dm";
import { FilterWarning } from "./FilterWarning";
import { DMComposer } from "./DMComposer";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  held: boolean;
  filter_level: string;
  read_at: string | null;
  created_at: string;
};

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

export function DMThread({
  threadId,
  mySessionId,
  otherHandle
}: {
  threadId: string;
  mySessionId: string;
  otherHandle: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMarkRef = useRef<number>(0);
  const seenDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/dm/threads/${threadId}`, {
        cache: "no-store"
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Load failed");
        setLoading(false);
        return;
      }
      setMessages((json.messages ?? []) as Message[]);
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  async function markRead() {
    const now = Date.now();
    // throttle: at most once every 3 seconds
    if (now - lastMarkRef.current < 3000) return;
    lastMarkRef.current = now;
    try {
      await fetch(`/api/dm/threads/${threadId}/read`, { method: "POST" });
    } catch {
      /* silent */
    }
  }

  // Initial load + polling fallback (in case realtime isn't subscribed)
  useEffect(() => {
    void load();
    void markRead();
    const t = setInterval(() => {
      void load();
      void markRead();
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Realtime subscription on this thread's messages.
  useEffect(() => {
    if (!mySessionId) return;

    let cancelled = false;
    let channel: ReturnType<
      ReturnType<typeof getBrowserClient>["channel"]
    > | null = null;

    try {
      const supabase = getBrowserClient();
      channel = supabase
        .channel(`dm:${threadId}:${mySessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_messages",
            filter: `thread_id=eq.${threadId}`
          },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as {
              id: string;
              sender_id: string;
              body: string;
              held: boolean;
              filter_level: string;
              read_at: string | null;
              created_at: string;
            };

            if (row.sender_id === mySessionId) return;
            if (row.held) return;

            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, row as Message];
            });

            // Mark as read immediately since user is viewing
            void markRead();
          }
        )
        .subscribe();
    } catch {
      /* silent */
    }

    return () => {
      cancelled = true;
      if (channel) {
        try {
          channel.unsubscribe();
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, mySessionId]);

  // Re-mark as read when the tab regains focus
  useEffect(() => {
    function onFocus() {
      void load();
      void markRead();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Debounced scroll to bottom whenever message count changes
  useEffect(() => {
    if (seenDebounceRef.current) clearTimeout(seenDebounceRef.current);
    seenDebounceRef.current = setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
    return () => {
      if (seenDebounceRef.current) clearTimeout(seenDebounceRef.current);
    };
  }, [messages.length]);

  // Are all my messages seen? Only show "Seen" under the last one I sent
  // if the OTHER person has read it.
  const lastMine = [...messages].reverse().find((m) => m.sender_id === mySessionId);
  const lastMineSeen = lastMine?.read_at != null;

  const bg = avatarColor(otherHandle);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <p className="empty-state-text">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 flex flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-border bg-paper/95 px-3 py-2.5 backdrop-blur-xl">
        <Link
          href="/inbox"
          className="flex h-9 w-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <Link
          href={`/u/${encodeURIComponent(otherHandle)}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-[0.9375rem] font-semibold text-white"
            style={{ background: bg }}
          >
            {otherHandle.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold text-ink">
              @{otherHandle}
            </p>
            <p className="truncate font-mono text-[0.65rem] text-faint">
              Private message
            </p>
          </div>
        </Link>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✉️</div>
            <p className="empty-state-title">Say hello</p>
            <p className="empty-state-text">
              This is a private conversation. Nobody else can see it.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="mb-4 rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-[0.7rem] leading-relaxed text-muted">
                🔒 Private conversation between you and @{otherHandle}.
                <br />
                Don&apos;t share phone numbers, emails, or links to other apps —
                they&apos;ll be blocked.
              </p>
            </div>

            {messages.map((m) => {
              const mine = m.sender_id === mySessionId;
              const isLastMine = mine && m.id === lastMine?.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[78%]">
                    <div
                      className={`rounded-2xl px-3.5 py-2 ${
                        mine
                          ? "bg-accent text-white"
                          : "bg-surface text-ink border border-border"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-snug">
                        {m.body}
                      </p>
                    </div>
                    <p
                      className={`mt-0.5 flex items-center gap-1 text-[0.65rem] text-faint ${
                        mine ? "justify-end" : ""
                      }`}
                    >
                      <span>{timeAgoShort(m.created_at)}</span>
                      {isLastMine && lastMineSeen ? (
                        <span className="text-accent">· Seen</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DMComposer
        threadId={threadId}
        onSent={(m) => {
          setMessages((prev) => [...prev, m as Message]);
        }}
        onBlocked={(reason) => setBlockReason(reason)}
      />

      {blockReason ? (
        <FilterWarning
          reason={blockReason}
          onClose={() => setBlockReason(null)}
        />
      ) : null}
    </div>
  );
}