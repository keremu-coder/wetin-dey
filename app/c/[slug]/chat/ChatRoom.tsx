"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

const QUICK_EMOJI = ["😂", "😢", "😮", "❤️", "🔥", "👏", "👍", "🙏"];

function timeShort(date: string): string {
  return new Date(date).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit"
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
  const [online, setOnline] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [me, setMe] = useState<string | null>(null);
  const [openReactionsFor, setOpenReactionsFor] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.handle ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      try {
        const res = await fetch(`/api/communities/${slug}/messages`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setMessages(json.messages ?? []);
        setOnline(json.online ?? []);
      } catch {
        /* ignore */
      }
    }

    fetchMessages();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchMessages();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

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
      setMessages((prev) => [...prev, json.message]);
      setBody("");
      setBusy(false);
      setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
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
        setMessages((prev) => [...prev, json.message]);
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
          <p className="mt-2 text-[0.875rem] text-muted">
            Tap Join on the space page first.
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
      <header className="flex items-center justify-between gap-2 border-b border-border bg-paper/95 px-3 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/c/${slug}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          >
            ←
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold text-ink">
              {emoji} {name}
            </p>
            <p className="font-mono text-[0.7rem] text-faint">
              {online.length > 0
                ? `${online.length} here now`
                : "Quiet right now"}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        {messages.length === 0 ? (
          <div className="mt-10 text-center">
            <div className="text-[2rem]">{emoji}</div>
            <p className="mt-3 font-serif text-[1rem] font-semibold text-ink">
              Welcome to {name}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Say something. Nobody will bite.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const isMe = me && m.author_handle === me;
              const bg = avatarColor(m.author_handle);
              const letter = m.author_handle.charAt(0).toUpperCase();
              const openReactions = openReactionsFor === m.id;
              const presence = presenceFromLastSeen(m.author_last_seen);

              return (
                <div
                  key={m.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[85%] items-end gap-2 ${
                      isMe ? "flex-row-reverse" : ""
                    }`}
                  >
                    {!isMe ? (
                      <div className="relative shrink-0">
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
                    <div
                      className={`group relative rounded-2xl px-3.5 py-2 ${
                        isMe
                          ? "rounded-tr-sm bg-accent text-white"
                          : "rounded-tl-sm bg-surface text-ink border border-border"
                      }`}
                    >
                      {!isMe ? (
                        <p className="mb-0.5 text-[0.7rem] font-semibold opacity-70">
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
                        <p className="whitespace-pre-wrap break-words text-[0.875rem] leading-snug">
                          {m.body}
                        </p>
                      ) : null}

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span
                          className={`font-mono text-[0.6rem] ${
                            isMe ? "text-white/70" : "text-faint"
                          }`}
                        >
                          {timeShort(m.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenReactionsFor(openReactions ? null : m.id)
                          }
                          className={`rounded-full px-1.5 py-0.5 text-[0.65rem] opacity-0 transition-opacity group-hover:opacity-100 ${
                            isMe ? "text-white/70" : "text-faint"
                          }`}
                        >
                          +😊
                        </button>
                      </div>

                      {m.reactions.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
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
                            isMe ? "right-0 -top-10" : "left-0 -top-10"
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
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={send}
        className="border-t border-border bg-paper/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md"
      >
        {recording ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-danger-soft px-3 py-2">
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

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={startVoice}
            disabled={recording || busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/5 text-[1.1rem] transition-colors hover:bg-ink/10 disabled:opacity-50"
            aria-label="Record voice note"
          >
            🎙️
          </button>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            rows={1}
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e as unknown as React.FormEvent);
              }
            }}
            className="!max-h-24 !min-h-[40px] flex-1 resize-none !py-2 !text-[0.9375rem]"
          />
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[1rem] text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}