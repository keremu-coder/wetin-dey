"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  playProfile,
  unlockAudio,
  showBrowserNotification,
  requestNotificationPermission,
  notificationPermission
} from "@/lib/sounds";
import {
  tapFeedback,
  impactFeedback,
  notifyFeedback,
  mentionFeedback
} from "@/lib/haptics";
import { loadPrefs, subscribePrefs, type SoundPrefs } from "@/lib/sound-prefs";
import { autocorrect, suggestCorrection } from "@/lib/autocorrect";
import {
  pickRecorderFormat,
  actualMime,
  extFromType
} from "@/lib/voice-recorder";
import {
  avatarColor,
  containsMentionOf,
  dayLabel,
  makeCid,
  timeWithDate,
  type Member,
  type Message
} from "@/lib/chat";
import { MessageBody } from "@/components/MessageBody";
import { PresenceDot, presenceFromLastSeen } from "@/components/PresenceDot";
import { StatusLine } from "@/components/StatusLine";
import { DEFAULT_FONT_ID } from "@/lib/bbm-fonts";
import {
  BroadcastBanner,
  type Broadcast
} from "@/components/BroadcastBanner";
import { BlockButton } from "@/components/BlockButton";
import { ChatRoomMembers } from "@/components/ChatRoomMembers";

// Lazy-loaded children — off the initial chat bundle, fetched on first
// use. Same components, same props, same behavior as before.
const VoiceNotePlayer = nextDynamic(() =>
  import("@/components/VoiceNotePlayer").then((m) => m.VoiceNotePlayer)
);

const InviteSheet = nextDynamic(
  () => import("@/components/InviteSheet").then((m) => m.InviteSheet),
  { ssr: false }
);

const FlagSheet = nextDynamic(
  () => import("@/components/FlagSheet").then((m) => m.FlagSheet),
  { ssr: false }
);

const BroadcastRecorder = nextDynamic(
  () =>
    import("@/components/BroadcastRecorder").then(
      (m) => m.BroadcastRecorder
    ),
  { ssr: false }
);

const QUICK_EMOJI = ["😂", "😢", "😮", "❤️", "🔥", "👍", "👎", "🙏"];

export function ChatRoom({
  slug,
  name,
  emoji,
  avatarUrl,
  isMember,
  isOwner,
  initialMessages,
  initialMembers,
  initialMe,
  initialMySessionId,
  initialFonts,
  initialStatuses
}: {
  slug: string;
  name: string;
  emoji: string;
  avatarUrl?: string | null;
  isMember: boolean;
  isOwner: boolean;
  initialMessages: Message[];
  initialMembers: Member[];
  initialMe: string | null;
  initialMySessionId: string | null;
  initialFonts: Record<string, string>;
  initialStatuses: Record<string, string>;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [me] = useState<string | null>(initialMe);
  const [mySessionId] = useState<string | null>(initialMySessionId);
  const [openReactionsFor, setOpenReactionsFor] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [broadcastRecorderOpen, setBroadcastRecorderOpen] = useState(false);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<
    Set<string>
  >(new Set());
  const [inviteBannerDismissed, setInviteBannerDismissed] = useState(false);
  const [flagTarget, setFlagTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [autocorrectOn, setAutocorrectOn] = useState(true);
  const [suggestion, setSuggestion] = useState<{
    original: string;
    suggested: string;
  } | null>(null);
  const [fontByHandle, setFontByHandle] =
    useState<Record<string, string>>(initialFonts);
  const [statusByHandle, setStatusByHandle] =
    useState<Record<string, string>>(initialStatuses);
  const [composerMode, setComposerMode] = useState<"voice" | "text">("voice");
  const [prefs, setPrefs] = useState<SoundPrefs>({
    profile: "bbm",
    send: true,
    receive: true,
    mention: true,
    notification: true,
    vibrate: true,
    browserNotifications: true
  });
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [showEnableBanner, setShowEnableBanner] = useState(false);
  const [blockedHandles, setBlockedHandles] = useState<Set<string>>(new Set());
  const [openBlockFor, setOpenBlockFor] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-seed the handle cache from server-provided members so the realtime
  // handler can resolve handles immediately.
  const handleCacheRef = useRef<Map<string, string>>(
    new Map(initialMembers.map((m) => [m.session_id, m.handle]))
  );

  const prefsRef = useRef<SoundPrefs>(prefs);

  // Pre-mark all server-provided handles as fetched so we don't re-request
  // their fonts/statuses on mount.
  const fetchedHandlesRef = useRef<Set<string>>(
    new Set([
      ...Object.keys(initialFonts),
      ...Object.keys(initialStatuses)
    ])
  );

  const askedForNotificationsRef = useRef(false);

  useEffect(() => {
    const initial = loadPrefs();
    setPrefs(initial);
    prefsRef.current = initial;
    const unsub = subscribePrefs((p) => {
      setPrefs(p);
      prefsRef.current = p;
    });
    setNotifPerm(notificationPermission());

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("wetindey:chat-visited:v1", "1");
      }
    } catch {
      /* ignore */
    }

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

  const loadBroadcasts = useMemo(
    () => async () => {
      try {
        const res = await fetch(`/api/communities/${slug}/broadcasts`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.broadcasts) {
          setBroadcasts(json.broadcasts as Broadcast[]);
        }
      } catch {
        /* silent */
      }
    },
    [slug]
  );

  useEffect(() => {
    void loadBroadcasts();
    const t = setInterval(() => {
      void loadBroadcasts();
    }, 60000);
    return () => clearInterval(t);
  }, [loadBroadcasts]);

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

            const p = prefsRef.current;
            const mentionedMe =
              row.body && me ? containsMentionOf(row.body, me) : false;

            if (mentionedMe && p.mention) {
              playProfile(p.profile, "mention");
            } else if (!mentionedMe && p.receive) {
              playProfile(p.profile, "receive");
            }

            if (p.vibrate) {
              if (mentionedMe) void mentionFeedback();
              else void notifyFeedback();
            }

            if (p.browserNotifications) {
              const preview = row.body
                ? row.body.slice(0, 90)
                : row.audio_url
                  ? "🎤 Voice note"
                  : "New message";
              showBrowserNotification(
                mentionedMe
                  ? `@${handle} mentioned you in ${name}`
                  : `${handle} in ${name}`,
                preview,
                `chat-${slug}`
              );
            }

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
  }, [slug, isMember, mySessionId, me, name]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!autocorrectOn) {
      setSuggestion(null);
      return;
    }
    setSuggestion(suggestCorrection(body));
  }, [body, autocorrectOn]);

  // Only fetch profiles for handles NOT already server-provided.
  useEffect(() => {
    const handles = Array.from(
      new Set(messages.map((m) => m.author_handle).filter(Boolean))
    );
    const missing = handles.filter((h) => !fetchedHandlesRef.current.has(h));
    if (missing.length === 0) return;

    for (const h of missing) fetchedHandlesRef.current.add(h);

    let cancelled = false;
    const joined = missing.join(",");

    fetch(`/api/sessions/profiles?handles=${encodeURIComponent(joined)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.fonts) setFontByHandle((prev) => ({ ...prev, ...d.fonts }));
        if (d?.statuses)
          setStatusByHandle((prev) => ({ ...prev, ...d.statuses }));
      })
      .catch(() => {
        for (const h of missing) fetchedHandlesRef.current.delete(h);
      });

    return () => {
      cancelled = true;
    };
  }, [messages]);

  const onlineHandles = useMemo(
    () =>
      members
        .filter((m) => presenceFromLastSeen(m.last_seen_at) === "online")
        .map((m) => m.handle),
    [members]
  );

  const visibleBroadcasts = useMemo(
    () => broadcasts.filter((b) => !dismissedBroadcastIds.has(b.id)),
    [broadcasts, dismissedBroadcastIds]
  );

  function applySuggestion() {
    if (!suggestion) return;
    const corrected = body.replace(
      new RegExp(suggestion.original + "$"),
      suggestion.suggested
    );
    setBody(corrected);
    setSuggestion(null);
    textareaRef.current?.focus();
  }

  function dismissBroadcast(id: string) {
    setDismissedBroadcastIds((prev) => new Set(prev).add(id));
  }

  async function maybeAskForNotifications() {
    if (askedForNotificationsRef.current) return;
    if (notificationPermission() === "granted") return;
    if (notificationPermission() === "denied") return;
    if (notificationPermission() === "unsupported") return;
    askedForNotificationsRef.current = true;
    try {
      const ok = await requestNotificationPermission();
      setNotifPerm(notificationPermission());
      if (ok) {
        const next = { ...prefsRef.current, browserNotifications: true };
        setPrefs(next);
        prefsRef.current = next;
      } else {
        setShowEnableBanner(true);
      }
    } catch {
      /* ignore */
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const raw = body.trim();
    if (!raw) return;

    unlockAudio();
    void maybeAskForNotifications();

    const finalBody = autocorrectOn ? autocorrect(raw) : raw;
    const p = prefsRef.current;
    const cid = makeCid();

    if (p.send) playProfile(p.profile, "send");
    if (p.vibrate) void impactFeedback();

    const optimistic: Message = {
      id: cid,
      body: finalBody,
      audio_url: null,
      created_at: new Date().toISOString(),
      author_handle: me ?? "you",
      author_last_seen: null,
      reactions: [],
      _cid: cid,
      _pending: true
    };

    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setSuggestion(null);
    setBusy(false);

    setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);

    try {
      const res = await fetch(`/api/communities/${slug}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: finalBody })
      });
      const json = await res.json();

      if (!res.ok || !json?.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m._cid === cid ? { ...m, _pending: false, _failed: true } : m
          )
        );
        setError(json?.error ?? "Message no send");
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m._cid === cid
            ? {
                ...(json.message as Message),
                _cid: cid,
                _pending: false,
                _failed: false
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m._cid === cid ? { ...m, _pending: false, _failed: true } : m
        )
      );
      setError("Network error");
    }
  }

  function retryFailed(cid: string) {
    const target = messages.find((m) => m._cid === cid);
    if (!target?.body) return;
    setMessages((prev) => prev.filter((m) => m._cid !== cid));
    setBody(target.body);
    setError("");
    setTimeout(() => {
      const fake = { preventDefault() {} } as React.FormEvent;
      void send(fake);
    }, 0);
  }

  function dismissFailed(cid: string) {
    setMessages((prev) => prev.filter((m) => m._cid !== cid));
  }

  async function startVoice() {
    try {
      unlockAudio();
      void maybeAskForNotifications();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const format = pickRecorderFormat();

      let mr: MediaRecorder;
      try {
        mr = format.mimeType
          ? new MediaRecorder(stream, { mimeType: format.mimeType })
          : new MediaRecorder(stream);
      } catch {
        mr = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const mime = actualMime(mr, format.mimeType);
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        await sendVoice(blob);
      };

      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      if (prefsRef.current.vibrate) void impactFeedback();
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
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function cancelVoice() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function sendVoice(blob: Blob) {
    const p = prefsRef.current;
    const cid = makeCid();
    const localUrl = URL.createObjectURL(blob);

    if (p.send) playProfile(p.profile, "send");

    const optimistic: Message = {
      id: cid,
      body: null,
      audio_url: localUrl,
      created_at: new Date().toISOString(),
      author_handle: me ?? "you",
      author_last_seen: null,
      reactions: [],
      _cid: cid,
      _pending: true
    };
    setMessages((prev) => [...prev, optimistic]);

    setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);

    try {
      const ext = extFromType(blob.type);
      const fd = new FormData();
      fd.set(
        "audio",
        new File([blob], `voice.${ext}`, {
          type: blob.type || "audio/webm"
        })
      );
      const res = await fetch(`/api/communities/${slug}/messages`, {
        method: "POST",
        body: fd
      });
      const json = await res.json();

      if (!res.ok || !json?.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m._cid === cid ? { ...m, _pending: false, _failed: true } : m
          )
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m._cid === cid
            ? {
                ...(json.message as Message),
                _cid: cid,
                _pending: false,
                _failed: false
              }
            : m
        )
      );

      setTimeout(() => {
        try {
          URL.revokeObjectURL(localUrl);
        } catch {
          /* ignore */
        }
      }, 5000);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m._cid === cid ? { ...m, _pending: false, _failed: true } : m
        )
      );
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
      if (prefsRef.current.vibrate) void tapFeedback();
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
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <p className="empty-state-title">Join {name} to enter the chat</p>
          <p className="empty-state-text">
            <Link href={`/c/${slug}`} className="text-accent underline">
              Go back to the space
            </Link>{" "}
            and tap Join.
          </p>
        </div>
      </main>
    );
  }

  const showInviteBanner =
    !inviteBannerDismissed && members.length < 5 && !inviteOpen;

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 flex flex-col bg-paper">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-paper/90 px-3 py-2.5 backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href={`/c/${slug}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-ink/5"
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
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-1.5 py-1 text-left transition-colors hover:bg-ink/5"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-[1.1rem]">
                {emoji}
              </div>
            )}
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

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              setInviteOpen(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep"
            aria-label="Invite people"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Invite
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

      <BroadcastBanner
        broadcasts={visibleBroadcasts}
        onDismiss={dismissBroadcast}
      />

      {showInviteBanner ? (
        <div className="flex items-center gap-3 border-b border-border bg-accent-soft px-3 py-2">
          <span className="text-[1.1rem]">👋</span>
          <p className="min-w-0 flex-1 text-[0.8125rem] text-ink">
            {members.length === 1
              ? "You are the only one here."
              : `Only ${members.length} people here.`}{" "}
            Invite friends so the chat comes alive.
          </p>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Invite
          </button>
          <button
            type="button"
            onClick={() => setInviteBannerDismissed(true)}
            className="shrink-0 text-faint transition-colors hover:text-ink"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="chat-log flex flex-1 flex-col overflow-y-auto py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{emoji}</div>
            <p className="empty-state-title">Welcome to {name}</p>
            <p className="empty-state-text">
              This is the beginning of this space. Say something.
            </p>
          </div>
        ) : (
          <div className="mt-auto">
            {messages
              .filter((m) => !blockedHandles.has(m.author_handle))
              .map((m, idx, arr) => {
                const key = m._cid ?? m.id;
                const prev = idx > 0 ? arr[idx - 1] : null;
                const isSameAuthor =
                  prev && prev.author_handle === m.author_handle;
                const withinWindow =
                  prev &&
                  new Date(m.created_at).getTime() -
                    new Date(prev.created_at).getTime() <
                    5 * 60 * 1000;
                const isGroupStart = !isSameAuthor || !withinWindow;

                const sameDayAsPrev =
                  prev &&
                  new Date(prev.created_at).toDateString() ===
                    new Date(m.created_at).toDateString();

                const isMe = me === m.author_handle || !!m._cid;
                const bg = avatarColor(m.author_handle);
                const letter = m.author_handle.charAt(0).toUpperCase();
                const presence = presenceFromLastSeen(m.author_last_seen);
                const mentionsMe =
                  me && m.body ? containsMentionOf(m.body, me) : false;
                const fontId = fontByHandle[m.author_handle] || DEFAULT_FONT_ID;
                const status = statusByHandle[m.author_handle];

                return (
                  <div key={key}>
                    {!sameDayAsPrev ? (
                      <div className="chat-day-divider">
                        {dayLabel(m.created_at)}
                      </div>
                    ) : null}

                    <div
                      className={`chat-msg message-in ${
                        isGroupStart ? "chat-msg-group-start" : ""
                      } ${m._pending ? "opacity-70" : ""}`}
                    >
                      {isGroupStart ? (
                        <Link
                          href={`/u/${encodeURIComponent(m.author_handle)}`}
                          className="relative shrink-0"
                          aria-label={`View @${m.author_handle}`}
                        >
                          <div
                            className="chat-msg-avatar"
                            style={{ background: bg }}
                          >
                            {letter}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <PresenceDot state={presence} />
                          </span>
                        </Link>
                      ) : (
                        <div className="chat-msg-avatar-spacer" />
                      )}

                      <div className="chat-msg-body">
                        {isGroupStart ? (
                          <>
                            <div className="chat-msg-header">
                              <Link
                                href={`/u/${encodeURIComponent(
                                  m.author_handle
                                )}`}
                                className="chat-msg-author transition-colors hover:text-accent"
                              >
                                {m.author_handle}
                                {isMe ? (
                                  <span className="ml-1.5 text-[0.7rem] font-normal text-accent">
                                    you
                                  </span>
                                ) : null}
                              </Link>
                              <span className="chat-msg-timestamp">
                                {m._pending
                                  ? "Sending…"
                                  : m._failed
                                    ? "Failed"
                                    : timeWithDate(m.created_at)}
                              </span>
                            </div>
                            {status ? (
                              <StatusLine
                                status={status}
                                className="mb-1 !text-[0.75rem]"
                              />
                            ) : null}
                          </>
                        ) : null}

                        {m.audio_url ? (
                          <VoiceNotePlayer src={m.audio_url} />
                        ) : null}

                        {m.body ? (
                          <MessageBody
                            body={m.body}
                            isOwn={isMe}
                            mentionsMe={mentionsMe}
                            fontId={fontId}
                          />
                        ) : null}

                        {m._failed ? (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => retryFailed(m._cid!)}
                              className="rounded-lg bg-danger px-3 py-1 text-[0.7rem] font-semibold text-white"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => dismissFailed(m._cid!)}
                              className="text-[0.7rem] text-faint hover:text-ink"
                            >
                              Discard
                            </button>
                          </div>
                        ) : null}

                        {m.reactions.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.reactions.map((r) => (
                              <button
                                key={r.emoji}
                                type="button"
                                onClick={() => react(m.id, r.emoji)}
                                className="rounded-full border border-border bg-surface px-2 py-0.5 text-[0.7rem] text-ink transition-colors hover:border-accent"
                              >
                                {r.emoji} {r.count}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {!m._pending && !m._failed ? (
                        <div className="chat-msg-actions">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenReactionsFor(
                                openReactionsFor === m.id ? null : m.id
                              )
                            }
                            aria-label="React"
                            title="React"
                          >
                            <span className="text-[0.9rem]">😊</span>
                          </button>
                          {!isMe ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setFlagTarget({
                                    id: m.id,
                                    label: `@${m.author_handle}`
                                  })
                                }
                                aria-label="Report"
                                title="Report"
                              >
                                <span className="text-[0.9rem]">🚨</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenBlockFor(
                                    openBlockFor === m.author_handle
                                      ? null
                                      : m.author_handle
                                  )
                                }
                                aria-label="Block"
                                title={`Block @${m.author_handle}`}
                              >
                                <span className="text-[0.9rem]">🚫</span>
                              </button>
                            </>
                          ) : null}

                          {!isMe && openBlockFor === m.author_handle ? (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setOpenBlockFor(null)}
                              />
                              <div className="absolute right-3 top-full z-40 mt-1 w-56 rounded-xl border border-border bg-surface p-2 shadow-card-hover">
                                <BlockButton
                                  handle={m.author_handle}
                                  className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft"
                                  onBlocked={(h) => {
                                    setOpenBlockFor(null);
                                    setBlockedHandles((prev) => {
                                      const next = new Set(prev);
                                      next.add(h);
                                      return next;
                                    });
                                  }}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {openReactionsFor === m.id ? (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setOpenReactionsFor(null)}
                          />
                          <div className="absolute right-3 top-full z-40 mt-1 flex gap-1 rounded-full border border-border bg-surface p-1.5 shadow-card-hover">
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
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {showEnableBanner && !recording ? (
        <div className="flex items-center gap-3 border-t border-border bg-accent-soft px-3 py-2">
          <span className="text-[1.1rem]">🔔</span>
          <p className="min-w-0 flex-1 text-[0.8125rem] text-ink">
            Turn on notifications so you know when someone replies.
          </p>
          <Link
            href="/settings/sounds"
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Open settings
          </Link>
          <button
            type="button"
            onClick={() => setShowEnableBanner(false)}
            className="shrink-0 text-faint transition-colors hover:text-ink"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ) : null}

      <form
        onSubmit={send}
        className="border-t border-border bg-paper/90 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl"
      >
        {error ? (
          <p className="mb-1 text-[0.75rem] text-danger">{error}</p>
        ) : null}

        {suggestion && composerMode === "text" ? (
          <div className="mb-1.5 flex items-center gap-2 text-[0.75rem]">
            <span className="text-muted">
              Correct{" "}
              <span className="font-medium text-ink line-through">
                {suggestion.original}
              </span>{" "}
              →{" "}
              <span className="font-medium text-accent-deep">
                {suggestion.suggested}
              </span>
              ?
            </span>
            <button
              type="button"
              onClick={applySuggestion}
              className="rounded-md bg-accent px-2 py-0.5 text-[0.7rem] font-semibold text-white"
            >
              Fix
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="text-faint hover:text-ink"
            >
              ✕
            </button>
          </div>
        ) : null}

        {recording ? (
          <div className="flex items-center gap-3 rounded-full border border-danger bg-danger-soft px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 animate-pulse items-center justify-center rounded-full bg-danger text-white">
              ●
            </span>
            <span className="flex-1 font-mono text-[0.9375rem] font-medium text-danger">
              {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:
              {String(recordSeconds % 60).padStart(2, "0")}
              <span className="ml-2 text-[0.75rem] font-normal">/ 00:30</span>
            </span>
            <button
              type="button"
              onClick={cancelVoice}
              className="shrink-0 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-[0.75rem] font-medium text-ink transition-colors hover:bg-ink/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopVoice}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-transform hover:bg-accent-deep active:scale-90"
              aria-label="Send voice note"
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
          </div>
        ) : composerMode === "voice" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                setComposerMode("text");
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-ink transition-colors hover:bg-ink/5"
              aria-label="Switch to text"
              title="Type instead"
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
                <rect x="2" y="6" width="20" height="12" rx="3" />
                <line x1="6" y1="10" x2="6" y2="14" />
                <line x1="10" y1="10" x2="10" y2="14" />
                <line x1="14" y1="10" x2="14" y2="14" />
                <line x1="18" y1="10" x2="18" y2="14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={startVoice}
              className="flex h-14 flex-1 items-center justify-center gap-3 rounded-full bg-accent text-white transition-transform hover:bg-accent-deep active:scale-[0.98]"
              aria-label="Tap to record voice note"
            >
              <svg
                width="24"
                height="24"
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
              <span className="font-serif text-[1rem] font-semibold">
                Tap to talk
              </span>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                setComposerMode("voice");
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-ink transition-colors hover:bg-ink/5"
              aria-label="Switch to voice"
              title="Talk instead"
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
            <div className="composer-shell flex flex-1 items-end gap-2 rounded-2xl border border-border-strong bg-surface px-3 py-2">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onBlur={() => {
                  if (autocorrectOn && body.trim()) {
                    setBody(autocorrect(body));
                  }
                }}
                placeholder="Message"
                rows={1}
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(e as unknown as React.FormEvent);
                  }
                }}
                className="!max-h-24 !min-h-[28px] flex-1 resize-none !border-0 !bg-transparent !py-1 !text-[0.9375rem] !outline-none !ring-0 focus:!border-0 focus:!ring-0 focus:!shadow-none"
                style={{ boxShadow: "none" }}
              />
            </div>
            <button
              type="submit"
              disabled={!body.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-transform hover:bg-accent-deep active:scale-90 disabled:opacity-30"
              aria-label="Send"
            >
              <svg
                width="20"
                height="20"
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
          </div>
        )}
      </form>

      {inviteOpen ? (
        <InviteSheet
          slug={slug}
          name={name}
          emoji={emoji}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {flagTarget ? (
        <FlagSheet
          targetType="message"
          targetId={flagTarget.id}
          targetLabel={flagTarget.label}
          onClose={() => setFlagTarget(null)}
        />
      ) : null}

      {broadcastRecorderOpen ? (
        <BroadcastRecorder
          slug={slug}
          onSent={() => {
            setBroadcastRecorderOpen(false);
            void loadBroadcasts();
          }}
          onClose={() => setBroadcastRecorderOpen(false)}
        />
      ) : null}

      <ChatRoomMembers
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        members={members}
        onlineCount={onlineHandles.length}
        isOwner={isOwner}
        prefs={prefs}
        notifPerm={notifPerm}
        onNotifPermChange={setNotifPerm}
        autocorrectOn={autocorrectOn}
        onAutocorrectChange={setAutocorrectOn}
        onOpenInvite={() => {
          unlockAudio();
          setInviteOpen(true);
        }}
        onOpenBroadcast={() => {
          unlockAudio();
          setBroadcastRecorderOpen(true);
        }}
        statusByHandle={statusByHandle}
      />
    </div>
  );
}