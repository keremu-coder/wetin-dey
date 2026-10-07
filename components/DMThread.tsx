"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { timeAgoShort } from "@/lib/dm";
import { FilterWarning } from "./FilterWarning";
import { DMComposer } from "./DMComposer";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  held: boolean;
  filter_level: string;
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

function timeWithDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `Today at ${d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  }
  return (
    d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  );
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

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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
                      className={`mt-0.5 text-[0.65rem] text-faint ${
                        mine ? "text-right" : ""
                      }`}
                    >
                      {timeAgoShort(m.created_at)}
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