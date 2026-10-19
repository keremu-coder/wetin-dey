"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { timeAgoShort } from "@/lib/dm";
import { makeCid } from "@/lib/chat";
import {
  playProfile,
  unlockAudio,
  showBrowserNotification
} from "@/lib/sounds";
import {
  loadPrefs,
  subscribePrefs,
  type SoundPrefs
} from "@/lib/sound-prefs";
import { notifyFeedback } from "@/lib/haptics";
import { useToast } from "./Toast";
import { useLiveRefreshUnread } from "./LiveStateProvider";
import { FilterWarning } from "./FilterWarning";
import { MessageBody } from "./MessageBody";
import { DMComposer } from "./DMComposer";
import { FlagSheet } from "./FlagSheet";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  held: boolean;
  filter_level: string;
  read_at: string | null;
  created_at: string;
  _cid?: string;
  _pending?: boolean;
  _failed?: boolean;
};

const DEFAULT_PREFS: SoundPrefs = {
  profile: "bbm",
  send: true,
  receive: true,
  mention: true,
  notification: true,
  vibrate: true,
  browserNotifications: true
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
  otherHandle,
  otherAvatarUrl,
  myColor,
  myFont,
  otherColor,
  otherFont,
  initialMessages
}: {
  threadId: string;
  mySessionId: string;
  otherHandle: string;
  otherAvatarUrl?: string | null;
  myColor?: string | null;
  myFont?: string | null;
  otherColor?: string | null;
  otherFont?: string | null;
  initialMessages: Message[];
}) {
  const toast = useToast();
  const refreshUnread = useLiveRefreshUnread();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [error, setError] = useState("");
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMarkRef = useRef<number>(0);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsRef = useRef<SoundPrefs>(DEFAULT_PREFS);

  function insertOptimistic(text: string): string {
    const cid = makeCid();
    const optimistic: Message = {
      id: cid,
      sender_id: mySessionId,
      body: text,
      held: false,
      filter_level: "ok",
      read_at: null,
      created_at: new Date().toISOString(),
      _cid: cid,
      _pending: true
    };
    setMessages((prev) => [...prev, optimistic]);
    return cid;
  }

  function resolveOptimistic(cid: string, real: Message) {
    setMessages((prev) =>
      prev.map((m) => (m._cid === cid ? { ...real, _cid: cid, _pending: false, _failed: false } : m))
    );
  }

  function failOptimistic(cid: string) {
    setMessages((prev) =>
      prev.map((m) => (m._cid === cid ? { ...m, _pending: false, _failed: true } : m))
    );
  }

  async function retryOptimistic(cid: string, text: string) {
    setMessages((prev) => prev.map((m) => (m._cid === cid ? { ...m, _pending: true, _failed: false } : m)));
    try {
      const res = await fetch(`/api/dm/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text })
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.blocked) { discardOptimistic(cid); setBlockReason(json.reason ?? "That message contains contact info."); }
        else failOptimistic(cid);
        return;
      }
      resolveOptimistic(cid, json.message as Message);
    } catch { failOptimistic(cid); }
  }

  function discardOptimistic(cid: string) {
    setMessages((prev) => prev.filter((m) => m._cid !== cid));
  }

  useEffect(() => {
    const initial = loadPrefs();
    prefsRef.current = initial;
    const unsub = subscribePrefs((p) => {
      prefsRef.current = p;
    });
    return unsub;
  }, []);

  useEffect(() => {
    unlockAudio();
    const handler = () => unlockAudio();
    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("touchstart", handler, true);
    return () => {
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("touchstart", handler, true);
    };
  }, []);

  async function refresh() {
    try {
      const res = await fetch(`/api/dm/threads/${threadId}`, {
        cache: "no-store"
      });
      const json = await res.json();
      if (!res.ok) return;
      setMessages((json.messages ?? []) as Message[]);
    } catch {
      /* silent */
    }
  }

  async function markRead() {
    const now = Date.now();
    if (now - lastMarkRef.current < 3000) return;
    lastMarkRef.current = now;
    try {
      await fetch(`/api/dm/threads/${threadId}/read`, { method: "POST" });
      refreshUnread();
    } catch {
      /* silent */
    }
  }

  async function blockUser() {
    if (blocking) return;
    setBlocking(true);
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: otherHandle, action: "block" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(data.error ?? "Could not block. Try again.", "error");
        setBlocking(false);
        return;
      }
      setMenuOpen(false);
      window.location.href = "/inbox";
    } catch {
      toast.show("Could not block. Check your connection.", "error");
      setBlocking(false);
    }
  }

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

            const p = prefsRef.current;
            if (p.receive) playProfile(p.profile, "receive");
            if (p.vibrate) void notifyFeedback();

            if (p.browserNotifications) {
              showBrowserNotification(
                `@${otherHandle} sent you a message`,
                row.body.slice(0, 90),
                `dm-${threadId}`
              );
            }

            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, row as Message];
            });

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
  }, [threadId, mySessionId, otherHandle]);

  useEffect(() => {
    void markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    const t = setInterval(() => {
      void refresh();
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    function onFocus() {
      void refresh();
      void markRead();
    }
    window.addEventListener("focus", onFocus);
    function onVis() {
      if (document.visibilityState === "visible") onFocus();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, [messages.length]);

  const lastMine = [...messages]
    .reverse()
    .find((m) => m.sender_id === mySessionId);
  const lastMineSeen = lastMine?.read_at != null;

  const bg = avatarColor(otherHandle);

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-paper">
      <header
        className="flex shrink-0 items-center gap-3 border-b border-border bg-paper/95 px-3 py-2.5 backdrop-blur-xl"
        style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top, 0px))" }}
      >
        <Link
          href="/inbox"
          className="flex h-10 w-10 items-center justify-center rounded-full text-brand transition-colors hover:bg-ink/5"
          aria-label="Back to inbox"
        >
          <svg
            width="24"
            height="24"
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
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          {otherAvatarUrl ? (
            <img
              src={otherAvatarUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold text-white"
              style={{ background: bg }}
            >
              {otherHandle.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold text-ink">
              @{otherHandle}
            </p>
            <p className="truncate text-[0.65rem] text-faint">
              Private message
            </p>
          </div>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="More options"
          >
          {"\u2022\u2022\u2022"}</button>

          {menuOpen ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-surface p-1 shadow-card-hover">
                <Link
                  href={`/u/${encodeURIComponent(otherHandle)}`}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
                >
                  View @{otherHandle}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setFlagOpen(true);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
                >
                  Report conversation
                </button>
                <button
                  type="button"
                  onClick={blockUser}
                  disabled={blocking}
                  className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft disabled:opacity-60"
                >
                  {blocking ? "Dey block…" : `Block @${otherHandle}`}
                </button>
              </div>
            </>
          ) : null}
        </div>
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
              const isLastMine = mine && !m._cid && m.id === lastMine?.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[78%]">
                    <div
                      className={`rounded-2xl px-3.5 py-2 ${
                        mine
                          ? "bg-surface2 text-ink"
                          : "bg-surface text-ink"
                      }`}
                    >
                      <MessageBody
                        body={m.body}
                        isOwn={mine}
                        fontId={mine ? myFont : otherFont}
                        colorId={mine ? myColor : otherColor}
                      />
                    </div>
                    <p
                      className={`mt-0.5 flex items-center gap-1 text-[0.65rem] text-faint ${
                        mine ? "justify-end" : ""
                      }`}
                    >
                      <span>{m._pending ? "Sending" : m._failed ? "Failed" : timeAgoShort(m.created_at)}</span>
                      {isLastMine ? (
                        <span className="ml-1 text-[0.65rem] font-bold text-brand" title={lastMineSeen ? "Read" : "Delivered"}>
                          {lastMineSeen ? "R" : "D"}
                        </span>
                      ) : null}
                    </p>
                    {m._failed ? (
                      <div className="mt-1 flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => void retryOptimistic(m._cid!, m.body)} className="rounded-lg bg-danger px-2.5 py-1 text-[0.7rem] font-semibold text-white">Retry</button>
                        <button type="button" onClick={() => discardOptimistic(m._cid!)} className="text-[0.7rem] text-faint hover:text-ink">Discard</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DMComposer
        threadId={threadId}
        onStart={(text) => insertOptimistic(text)}
        onSuccess={(cid, m) => resolveOptimistic(cid, m)}
        onFail={(cid) => failOptimistic(cid)}
        onBlocked={(reason, cid) => { discardOptimistic(cid); setBlockReason(reason); }}
      />

      {error ? (
        <p className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-danger-soft px-3 py-1.5 text-[0.75rem] text-danger">
          {error}
        </p>
      ) : null}

      {blockReason ? (
        <FilterWarning
          reason={blockReason}
          onClose={() => setBlockReason(null)}
        />
      ) : null}

      {flagOpen ? (
        <FlagSheet
          targetType="dm_thread"
          targetId={threadId}
          targetLabel={`conversation with @${otherHandle}`}
          onClose={() => setFlagOpen(false)}
        />
      ) : null}
    </div>
  );
}
