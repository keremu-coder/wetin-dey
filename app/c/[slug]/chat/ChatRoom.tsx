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
  containsMentionOf,
  makeCid,
  type Member,
  type Message,
  type MessageParent
} from "@/lib/chat";
import { presenceFromLastSeen } from "@/components/PresenceDot";
import { DEFAULT_FONT_ID } from "@/lib/fonts-registry";
import { DEFAULT_TEXT_COLOR_ID } from "@/lib/text-colors";
import {
  BroadcastBanner,
  type Broadcast
} from "@/components/BroadcastBanner";
import { ChatRoomMembers } from "@/components/ChatRoomMembers";
import { MessageRow } from "@/components/MessageRow";
import { ChatHeader } from "@/components/ChatHeader";
const VoiceRoom = nextDynamic(() => import("@/components/VoiceRoom").then(m => m.VoiceRoom), { ssr: false });
import { ChatComposer } from "@/components/ChatComposer";


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

export function ChatRoom({
  communityId,
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
  initialColors,
  initialStatuses
}: {
  communityId: string;
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
  initialColors: Record<string, string>;
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
  const [colorByHandle] =
    useState<Record<string, string>>(initialColors);
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
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [viewingMedia, setViewingMedia] = useState<{url: string, type: string} | null>(null);
  const [voiceRoomOpen, setVoiceRoomOpen] = useState(false);
  const [playInvite, setPlayInvite] = useState(false);
  const [joiningInvite, setJoiningInvite] = useState(false);
  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get("play") === "1") { setPlayInvite(true); if (isMember) setVoiceRoomOpen(true); } } catch {}
  }, [isMember]);
  
  // Track visual viewport for iOS keyboard
  const [viewportHeight, setViewportHeight] = useState<string>("100dvh");

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      setViewportHeight(`${window.visualViewport!.height}px`);
      window.scrollTo(0, 0);
    };

    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    handleResize(); // Initial call

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  async function handleViewMedia(m: Message) {
    if ((m as any).viewed_at) return;
    try {
      const res = await fetch(`/api/community-messages/${m.id}/view`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) return;
      setViewingMedia({ url: json.url, type: json.type });
      setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, viewed_at: new Date().toISOString() } as any : msg));
    } catch {}
  }

  async function blockUserFromChat(_messageId: string, handle: string) {
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, action: "block" })
      });
      if (!res.ok) {
        setBlockedNotice("Could not block. Check your connection and try again.");
        setTimeout(() => setBlockedNotice(null), 6000);
        return;
      }
      setBlockedHandles((prev) => {
        const next = new Set(prev);
        next.add(handle);
        return next;
      });
      setBlockedNotice(`You blocked @${handle}. Their messages are hidden. Unblock from Settings → Blocked users.`);
      setTimeout(() => setBlockedNotice(null), 6000);
    } catch (e) {
      setBlockedNotice("Could not block. Check your connection and try again.");
      setTimeout(() => setBlockedNotice(null), 6000);
    }
  }

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleCacheRef = useRef<Map<string, string>>(
    new Map(initialMembers.map((m) => [m.session_id, m.handle]))
  );

  const prefsRef = useRef<SoundPrefs>(prefs);

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
    } catch {}

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
        const res = await fetch(`/api/communities/${slug}/broadcasts`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.broadcasts) {
          setBroadcasts(json.broadcasts as Broadcast[]);
        }
      } catch {}
    },
    [slug]
  );

  useEffect(() => {
    void loadBroadcasts();
    const t = setInterval(() => { void loadBroadcasts(); }, 60000);
    return () => clearInterval(t);
  }, [loadBroadcasts]);

  useEffect(() => {
    if (!isMember || !mySessionId) return;

    let channel: ReturnType<ReturnType<typeof getBrowserClient>["channel"]> | null = null;

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
            const row = payload.new as any;

            if (row.session_id === mySessionId) return;

            const handle = handleCacheRef.current.get(row.session_id) ?? "Anonymous";

            const incoming: Message = {
              id: row.id,
              body: row.body,
              audio_url: row.audio_url,
              media_path: row.media_path,
              media_type: row.media_type,
              viewed_at: row.viewed_at,
              created_at: row.created_at,
              author_handle: handle, 
              parent_id: row.parent_id ?? null, 
              parent: row.parent_id ? (() => { const f = messagesRef.current.find((mm) => mm.id === row.parent_id); return f ? { id: f.id, author_handle: f.author_handle, body: f.body, audio_url: f.audio_url } : null; })() : null,
              author_last_seen: null,
              reactions: []
            } as any;

            const p = prefsRef.current;
            const mentionedMe = row.body && me ? containsMentionOf(row.body, me) : false;

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
                : row.media_path
                  ? "📷 View once media"
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

  // Scroll to bottom when messages change OR keyboard opens (viewportHeight changes)
  // Scroll to bottom on initial mount and when keyboard opens
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 100);
    return () => clearTimeout(t);
  }, [viewportHeight]);

  // Soft scroll when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
      if (nearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    if (!autocorrectOn) {
      setSuggestion(null);
      return;
    }
    setSuggestion(suggestCorrection(body));
  }, [body, autocorrectOn]);

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
    } catch {}
  }

  async function send(e: React.FormEvent, parentId: string | null = null) {
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
      parent_id: parentId, parent: parentId ? (() => { const f = messagesRef.current.find((mm) => mm.id === parentId); return f ? { id: f.id, author_handle: f.author_handle, body: f.body, audio_url: f.audio_url } : null; })() : null, _cid: cid,
      _pending: true
    } as any;

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
        body: JSON.stringify({ body: finalBody, ...(parentId ? { parent_id: parentId } : {}) })
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
    const retryParentId = target.parent_id ?? null;
    setMessages((prev) => prev.filter((m) => m._cid !== cid));
    setBody(target.body);
    setError("");
    setTimeout(() => {
      const fake = { preventDefault() {} } as React.FormEvent;
      void send(fake, retryParentId);
    }, 0);
  }

  function dismissFailed(cid: string) {
    setMessages((prev) => prev.filter((m) => m._cid !== cid));
  }

  async function startVoice() {
    try {
      unlockAudio();
      void maybeAskForNotifications();
      const voicePid = replyTo?.id ?? null;
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
        await sendVoice(blob, voicePid);
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

  async function sendVoice(blob: Blob, parentId: string | null = null) {
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
      parent_id: parentId, parent: parentId ? (() => { const f = messagesRef.current.find((mm) => mm.id === parentId); return f ? { id: f.id, author_handle: f.author_handle, body: f.body, audio_url: f.audio_url } : null; })() : null, _cid: cid,
      _pending: true
    } as any;
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
      if (parentId) fd.set("parent_id", parentId);
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
        } catch {}
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
    } catch {}
  }

  async function joinFromInvite() {
    setJoiningInvite(true);
    try { const r = await fetch("/api/communities/" + slug + "/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join" }) }); if (r.ok) { window.location.reload(); return; } } catch {}
    setJoiningInvite(false);
  }
  if (!isMember && playInvite) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 pb-24 text-center">
        <div className="text-[3rem]">🎴</div>
        <h1 className="mt-3 font-serif text-[1.5rem] font-semibold text-ink">You are invited to play Whot</h1>
        <p className="mt-2 text-[1rem] text-muted">{name} is playing now. You can join the game without an account.</p>
        <button type="button" onClick={() => { unlockAudio(); setVoiceRoomOpen(true); }} className="mt-8 w-full rounded-2xl bg-brand px-6 py-4 text-[1.0625rem] font-semibold text-white">Play now</button>
        <button type="button" onClick={joinFromInvite} disabled={joiningInvite} className="mt-3 w-full rounded-2xl border border-border-strong px-6 py-4 text-[1.0625rem] font-semibold text-ink disabled:opacity-60">{joiningInvite ? "Joining..." : "Join the " + name + " community"}</button>
        {voiceRoomOpen ? (<VoiceRoom roomName={slug} spaceName={name} communityId={communityId} currentSessionId={mySessionId ?? ""} onClose={() => setVoiceRoomOpen(false)} />) : null}
      </main>
    );
  }
  if (!isMember) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link
          href={`/c/${slug}`}
          className="text-[0.7rem] text-faint hover:text-brand"
        >
          ← Back to space
        </Link>
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <p className="empty-state-title">Join {name} to enter the chat</p>
          <p className="empty-state-text">
            <Link href={`/c/${slug}`} className="text-brand underline">
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
    <div 
      className="fixed inset-x-0 top-0 z-50 flex flex-col bg-paper overflow-hidden" 
      style={{ height: viewportHeight, paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <ChatHeader
        slug={slug}
        name={name}
        emoji={emoji}
        avatarUrl={avatarUrl ?? null}
        onlineHandles={onlineHandles}
        memberCount={members.length}
        onOpenMembers={() => setMembersOpen(true)}
        onOpenVoice={() => setVoiceRoomOpen(true)}
      />

      <BroadcastBanner
        broadcasts={visibleBroadcasts}
        onDismiss={dismissBroadcast}
      />

      {showInviteBanner ? (
        <div className="flex items-center gap-3 border-b border-border bg-brand-tint px-3 py-2">
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
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-brand-soft"
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

      {blockedNotice ? (
        <div className="mx-3 mb-2 rounded-xl border border-border bg-surface px-3 py-2 text-[0.8125rem] leading-relaxed text-ink/90">
          {blockedNotice}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="chat-log flex-1 overflow-y-auto pt-4 pb-12"
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
          <div>
            {messages
              .filter((m) => !blockedHandles.has(m.author_handle))
              .map((m, idx, arr) => {
                const prev = idx > 0 ? arr[idx - 1] : null;
                const fontId =
                  fontByHandle[m.author_handle] || DEFAULT_FONT_ID;
                const colorId =
                  colorByHandle[m.author_handle] || DEFAULT_TEXT_COLOR_ID;
                const status = statusByHandle[m.author_handle];
                const mentionsMe =
                  me && m.body ? containsMentionOf(m.body, me) : false;
                return (
                  <MessageRow
                    key={m._cid ?? m.id}
                    onViewMedia={handleViewMedia}
                    m={m}
                    prev={prev}
                    me={me}
                    fontId={fontId}
                    colorId={colorId}
                    status={status}
                    mentionsMe={mentionsMe}
                    openReactionsFor={openReactionsFor}
                    onReact={react}
                    onReply={setReplyTo}
                    onReport={(id, label) => setFlagTarget({ id, label })}
                    onBlock={blockUserFromChat}
                    onToggleReactions={setOpenReactionsFor}
                    onRetry={retryFailed}
                    onDiscard={dismissFailed}
                  />
                );
              })}
          </div>
        )}
      </div>

      {showEnableBanner && !recording ? (
        <div className="flex items-center gap-3 border-t border-border bg-brand-tint px-3 py-2">
          <span className="text-[1.1rem]">🔔</span>
          <p className="min-w-0 flex-1 text-[0.8125rem] text-ink">
            Turn on notifications so you know when someone replies.
          </p>
          <Link
            href="/settings/sounds"
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-brand-soft"
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

      
        <ChatComposer
        slug={slug}
        isPublic={false}
        onMediaStart={(cid) => {
          const optimistic: Message = { id: cid, body: null, audio_url: null, media_path: "pending", media_type: "photo", created_at: new Date().toISOString(), author_handle: me ?? "you", author_last_seen: null, reactions: [], parent_id: null, parent: null, _cid: cid, _pending: true } as any;
          setMessages(prev => [...prev, optimistic]);
        }}
        onMediaUploaded={(msg) => {
          setMessages(prev => prev.map(m => m._pending && (m as any).media_path === "pending" ? msg : m));
        }}
        onMediaFail={(cid) => {
          setMessages(prev => prev.filter(m => m._cid !== cid));
        }}
        body={body}
        onBodyChange={setBody}
        error={error}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        suggestion={suggestion}
        onApplySuggestion={applySuggestion}
        onDismissSuggestion={() => setSuggestion(null)}
        recording={recording}
        recordSeconds={recordSeconds}
        onCancelVoice={cancelVoice}
        onStopVoice={stopVoice}
        onStartVoice={startVoice}
        composerMode={composerMode}
        onSwitchToText={() => {
          unlockAudio();
          setComposerMode("text");
          setTimeout(() => textareaRef.current?.focus(), 50);
        }}
        onSwitchToVoice={() => {
          unlockAudio();
          setComposerMode("voice");
        }}
        textareaRef={textareaRef}
        autocorrectOn={autocorrectOn}
        onBodyAutocorrected={setBody}
        onSubmit={(e, pid) => {
          setReplyTo(null);
          void send(e, pid);
        }}
      />

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

      {voiceRoomOpen ? (
        <VoiceRoom
          roomName={slug}
          spaceName={name}
          communityId={communityId}
          currentSessionId={mySessionId ?? ""}
          onClose={() => setVoiceRoomOpen(false)}
        />
      ) : null}

      {viewingMedia ? (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => setViewingMedia(null)}
        >
          <div className="relative max-h-full max-w-full p-4">
            <button 
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white"
              onClick={() => setViewingMedia(null)}
            >
              Close
            </button>
            {viewingMedia.type === "video" ? (
              <video src={viewingMedia.url} autoPlay controls playsInline className="max-h-[85vh] max-w-full rounded-lg object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewingMedia.url} alt="View once media" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
