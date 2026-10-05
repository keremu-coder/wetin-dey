"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { playBbmPing, vibrate } from "@/lib/bbm-sound";
import { PresenceDot, presenceFromLastSeen } from "@/components/PresenceDot";

type Reaction = { emoji: string; count: number };

type Message = {
  id: string;
  body: string | null;
  audio_url: string | null;
  created_at: string;
  author_handle: string;
  author_last_seen: string | null;
  reactions: Reaction[];
};

type Member = {
  session_id: string;
  handle: string;
  last_seen_at: string | null;
  role: string;
};

const QUICK_EMOJI = ["😂", "😢", "😮", "❤️", "🔥", "👏", "👍", "🙏"];

function timeShort(date: string): string {
  return new Date(date).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function dayLabel(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const colors = [
    "bg-[#C0392B]",
    "bg-[#D97706]",
    "bg-[#1F7A4D]",
    "bg-[#7C3AED]",
    "bg-[#0E7490]",
    "bg-[#BE185D]"
  ];
  return colors[Math.abs(h) % colors.length];
}

export function ChatRoom({
  slug,
  name,
  emoji,
  isMember
}: {
  slug: string;
  name: string;
  emoji: string;
  isMember: boolean;
  isOwner: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [me, setMe] = useState<string | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [openReactionsFor, setOpenReactionsFor] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.handle) setMe(d.handle);
        if (d?.id) setMySessionId(d.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/communities/${slug}/members`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.members) return;
        setMembers(d.members);
        for (const m of d.members as Member[]) {
          handleCacheRef.current.set(m.session_id, m.handle);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/communities/${slug}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.messages) return;
        setMessages(json.messages as Message[]);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!isMember || !mySessionId) return;

    let channel: ReturnType<
      ReturnType<typeof getBrowserClient>["channel"]
    > | null = null;

    try {
      const supabase = getBrowserClient();

      channel = supabase
        .channel(`community:${slug}:${mySessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "community_messages"
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              session_id: string;
              body: string | null;
              audio_url: string | null;
              created_at: string;
            };

            if (row.session_id === mySessionId) return;

            const handle =
              handleCacheRef.current.get(row.session_id) ?? "Anonymous";

            const incoming: Message = {
              id: row.id,
              body: row.body,
              audio_url: row.audio_url,
              created_at: row.created_at,
              author_handle: handle,
              author_last_seen: null,
              reactions: []
            };

            if (soundOn) playBbmPing();
            if (vibrateOn) vibrate(35);

            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, incoming];
            });

            setTimeout(() => {
              const el = scrollRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }, 80);
          }
        )
        .subscribe();

      return () => {
        if (channel) channel.unsubscribe();
      };
    } catch {
      return;
    }
  }, [slug, isMember, mySessionId, soundOn, vibrateOn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onlineHandles = useMemo(
    () =>
      members
        .filter((m) => presenceFromLastSeen(m.last_seen_at) === "online")
        .map((m) => m.handle),
    [members]
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/communities/${slug}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim() })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Message no send");
        setBusy(false);
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === json.message.id)) return prev;
        return [...prev, json.message];
      });
      setBody("");
      setBusy(false);
      if (vibrateOn) vibrate(20);
      setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 80);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await sendVoice(blob);
      };
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 30) {
            stopVoice();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone no work");
    }
  }

  function stopVoice() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function sendVoice(blob: Blob) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("audio", new File([blob], "voice.webm", { type: "audio/webm" }));
      const res = await fetch(`/api/communities/${slug}/messages`, {
        method: "POST",
        body: fd
      });
      const json = await res.json();
      if (res.ok) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === json.message.id)) return prev;
          return [...prev, json.message];
        });
      }
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    setOpenReactionsFor(null);
    try {
      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji })
      });
      if (!res.ok) return;
      const json = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: json.reactions ?? [] } : m
        )
      );
      if (vibrateOn) vibrate(15);
    } catch {
      /* ignore */
    }
  }

  if (!isMember) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link
          href={`/c/${slug}`}
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-accent"
        >
          ← Back to space
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-[2rem]">💬</div>
          <p className="mt-3 font-serif text-[1.1rem] font-semibold text-ink">
            Join {name} to enter the chat
          </p>
          <Link
            href={`/c/${slug}`}
            className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white"
          >
            Go to space
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 flex flex-col bg-paper">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-border bg-paper/90 px-3 py-2.5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/c/${slug}`}
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
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="flex min-w-0 items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-ink/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-[1.1rem]">
              {emoji}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-[0.9375rem] font-semibold text-ink">
                {name}
              </p>
              <p className="truncate font-mono text-[0.65rem] text-faint">
                {onlineHandles.length > 0
                  ? onlineHandles.slice(0, 2).join(", ") +
                    (onlineHandles.length > 2
                      ? ` +${onlineHandles.length - 2}`
                      : "")
                  : `${members.length} members`}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setSoundOn((v) => !v);
              if (!soundOn) playBbmPing();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
            aria-label="Toggle sound"
          >
            {soundOn ? "🔔" : "🔕"}
          </button>
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
            aria-label="Members"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages canvas */}
      <div
        ref={scrollRef}
        className="chat-canvas flex-1 overflow-y-auto px-3 py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        {messages.length === 0 ? (
          <div className="mt-12 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ink/5 text-[2.5rem]">
              {emoji}
            </div>
            <p className="mt-4 font-serif text-[1.1rem] font-semibold text-ink">
              Welcome to {name}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Say something. Nobody will bite.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((m, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const next = idx < messages.length - 1 ? messages[idx + 1] : null;
              const isMe = me && m.author_handle === me;
              const bg = avatarColor(m.author_handle);
              const letter = m.author_handle.charAt(0).toUpperCase();
              const openReactions = openReactionsFor === m.id;
              const presence = presenceFromLastSeen(m.author_last_seen);

              const sameDayAsPrev =
                prev &&
                new Date(prev.created_at).toDateString() ===
                  new Date(m.created_at).toDateString();
              const sameSenderAsPrev =
                prev && prev.author_handle === m.author_handle && sameDayAsPrev;
              const sameSenderAsNext =
                next && next.author_handle === m.author_handle;
              const showAvatar = !isMe && !sameSenderAsPrev;
              const isLastInGroup = !sameSenderAsNext;

              return (
                <div key={m.id}>
                  {!sameDayAsPrev ? (
                    <div className="my-4 flex items-center justify-center">
                      <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                        {dayLabel(m.created_at)}
                      </span>
                    </div>
                  ) : null}

                  <div
                    className={`flex ${
                      isMe ? "justify-end" : "justify-start"
                    } ${sameSenderAsPrev ? "mt-0.5" : "mt-2"}`}
                  >
                    <div
                      className={`flex max-w-[80%] items-end gap-2 ${
                        isMe ? "flex-row-reverse" : ""
                      }`}
                    >
                      {!isMe ? (
                        <div className="w-7 shrink-0">
                          {showAvatar ? (
                            <div className="relative">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full ${bg} text-[0.7rem] font-semibold text-white`}
                              >
                                {letter}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5">
                                <PresenceDot state={presence} />
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div
                        className={`group relative ${
                          isMe ? "bubble-in-sent" : "bubble-in-received"
                        } ${
                          isMe
                            ? isLastInGroup
                              ? "chat-bubble-sent"
                              : "chat-bubble-sent-grouped"
                            : isLastInGroup
                            ? "chat-bubble-received"
                            : "chat-bubble-received-grouped"
                        } px-3.5 py-2`}
                      >
                        {!isMe && !sameSenderAsPrev ? (
                          <p className="mb-0.5 text-[0.7rem] font-semibold text-accent-deep">
                            {m.author_handle}
                          </p>
                        ) : null}

                        {m.audio_url ? (
                          <audio
                            src={m.audio_url}
                            controls
                            className="my-1 h-8 max-w-[220px]"
                          />
                        ) : null}

                        {m.body ? (
                          <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-[1.35]">
                            {m.body}
                          </p>
                        ) : null}

                        <div
                          className={`mt-0.5 flex items-center justify-end gap-1 text-[0.6rem] ${
                            isMe
                              ? "text-white/70"
                              : "text-black/40 dark:text-white/45"
                          }`}
                        >
                          <span className="font-mono">
                            {timeShort(m.created_at)}
                          </span>
                          {isMe ? (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-label="Sent"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenReactionsFor(openReactions ? null : m.id)
                          }
                          className={`absolute -top-3 ${
                            isMe ? "left-1" : "right-1"
                          } flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-[0.75rem] opacity-0 shadow-sm transition-opacity group-hover:opacity-100`}
                          aria-label="React"
                        >
                          😊
                        </button>

                        {m.reactions.length > 0 ? (
                          <div
                            className={`mt-1.5 flex flex-wrap gap-1 ${
                              isMe ? "justify-end" : ""
                            }`}
                          >
                            {m.reactions.map((r) => (
                              <button
                                key={r.emoji}
                                type="button"
                                onClick={() => react(m.id, r.emoji)}
                                className={`rounded-full px-1.5 py-0.5 text-[0.7rem] ${
                                  isMe
                                    ? "bg-white/20 text-white"
                                    : "bg-ink/5 text-ink"
                                }`}
                              >
                                {r.emoji} {r.count}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {openReactions ? (
                          <div
                            className={`absolute z-30 flex gap-1 rounded-full border border-border bg-surface p-1.5 shadow-card-hover ${
                              isMe ? "right-0 -top-12" : "left-0 -top-12"
                            }`}
                          >
                            {QUICK_EMOJI.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => react(m.id, e)}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[1rem] transition-colors hover:bg-ink/10"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="border-t border-border bg-paper/90 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl"
      >
        {recording ? (
          <div className="mb-2 flex items-center justify-between rounded-2xl bg-danger-soft px-3 py-2">
            <span className="text-[0.8125rem] font-medium text-danger">
              ● Recording… {recordSeconds}s / 30s
            </span>
            <button
              type="button"
              onClick={stopVoice}
              className="rounded-lg bg-danger px-3 py-1 text-[0.75rem] font-semibold text-white"
            >
              Send
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mb-1 text-[0.75rem] text-danger">{error}</p>
        ) : null}

        <div className="composer-shell flex items-end gap-2 rounded-3xl border border-border-strong bg-surface px-1.5 py-1">
          <button
            type="button"
            onClick={startVoice}
            disabled={recording || busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-ink/5 disabled:opacity-50"
            aria-label="Record voice note"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message"
            rows={1}
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e as unknown as React.FormEvent);
              }
            }}
            className="!max-h-24 !min-h-[34px] flex-1 resize-none !border-0 !bg-transparent !py-1.5 !text-[0.9375rem] !outline-none !ring-0 focus:!border-0 focus:!ring-0 focus:!shadow-none"
            style={{ boxShadow: "none" }}
          />
          {body.trim() ? (
            <button
              type="submit"
              disabled={busy}
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[0.95rem] text-white transition-transform hover:bg-accent-deep active:scale-90 disabled:opacity-40"
              aria-label="Send"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </form>

      {/* Members sheet */}
      {membersOpen ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 fade-in"
            onClick={() => setMembersOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-[60] h-full w-[85%] max-w-sm overflow-y-auto border-l border-border bg-paper slide-in-right">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-paper/95 px-4 py-3 backdrop-blur-xl">
              <div>
                <p className="font-serif text-[1.05rem] font-semibold text-ink">
                  Members
                </p>
                <p className="font-mono text-[0.65rem] text-faint">
                  {onlineHandles.length} online · {members.length} total
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMembersOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-border px-4 py-3">
              <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                Chat settings
              </p>
              <div className="flex items-center justify-between py-2">
                <span className="text-[0.875rem] text-ink">Ping sound</span>
                <button
                  type="button"
                  onClick={() => setSoundOn((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    soundOn ? "bg-accent" : "bg-ink/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      soundOn ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[0.875rem] text-ink">Vibrate</span>
                <button
                  type="button"
                  onClick={() => {
                    setVibrateOn((v) => !v);
                    if (!vibrateOn) vibrate(30);
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    vibrateOn ? "bg-accent" : "bg-ink/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      vibrateOn ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <MemberGroup
              label="Online"
              members={members.filter(
                (m) => presenceFromLastSeen(m.last_seen_at) === "online"
              )}
              emptyText="Nobody here right now"
            />
            <MemberGroup
              label="Away"
              members={members.filter(
                (m) => presenceFromLastSeen(m.last_seen_at) === "away"
              )}
            />
            <MemberGroup
              label="Offline"
              members={members.filter(
                (m) => presenceFromLastSeen(m.last_seen_at) === "offline"
              )}
            />
          </aside>
        </>
      ) : null}
    </div>
  );
}

function MemberGroup({
  label,
  members,
  emptyText
}: {
  label: string;
  members: Member[];
  emptyText?: string;
}) {
  if (members.length === 0 && !emptyText) return null;

  return (
    <section className="py-2">
      <p className="px-4 py-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
        {label} — {members.length}
      </p>
      {members.length === 0 ? (
        <p className="px-4 py-2 text-[0.8125rem] text-muted">{emptyText}</p>
      ) : (
        members.map((m) => {
          const presence = presenceFromLastSeen(m.last_seen_at);
          const bg = avatarColor(m.handle);
          return (
            <div key={m.session_id} className="flex items-center gap-3 px-4 py-3">
              <div className="relative">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${bg} text-[0.85rem] font-semibold text-white`}
                >
                  {m.handle.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot state={presence} size="md" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium text-ink">
                  @{m.handle}
                </p>
                <p className="text-[0.7rem] capitalize text-muted">{m.role}</p>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}