"use client";

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { useRef } from "react";
import { tapFeedback } from "@/lib/haptics";
import {
  avatarColor,
  dayLabel,
  timeWithDate,
  type Message
} from "@/lib/chat";
import { MessageBody } from "./MessageBody";
import { PresenceDot, presenceFromLastSeen } from "./PresenceDot";
import { StatusLine } from "./StatusLine";
import { BlockButton } from "./BlockButton";

const VoiceNotePlayer = nextDynamic(() =>
  import("./VoiceNotePlayer").then((m) => m.VoiceNotePlayer)
);

const QUICK_EMOJI = ["\u{1F602}", "\u{1F622}", "\u{1F62E}", "\u2764\uFE0F", "\u{1F525}", "\u{1F44D}", "\u{1F44E}", "\u{1F64F}"];

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_MAX_PX = 80;
const SWIPE_DAMPING = 0.7;
const LONG_PRESS_MS = 450;

export type MessageRowProps = {
  m: Message;
  prev: Message | null;
  me: string | null;
  fontId: string;
  colorId?: string;
  status: string | undefined;
  mentionsMe: boolean;
  openReactionsFor: string | null;
  openBlockFor: string | null;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (m: Message) => void;
  onReport: (id: string, label: string) => void;
  onToggleReactions: (id: string | null) => void;
  onToggleBlock: (handle: string | null) => void;
  onBlocked: (handle: string) => void;
  onRetry: (cid: string) => void;
  onDiscard: (cid: string) => void;
};

export function MessageRow({
  m,
  prev,
  me,
  fontId,
  colorId,
  status,
  mentionsMe,
  openReactionsFor,
  openBlockFor,
  onReact,
  onReply,
  onReport,
  onToggleReactions,
  onToggleBlock,
  onBlocked,
  onRetry,
  onDiscard
}: MessageRowProps) {
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeLocked = useRef<"horizontal" | "vertical" | null>(null);
  const swipeEl = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (m._pending || m._failed) return;
    const t = e.touches[0];
    swipeStartX.current = t.clientX;
    swipeStartY.current = t.clientY;
    swipeLocked.current = null;
    swipeEl.current = e.currentTarget;
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      void tapFeedback();
      onToggleReactions(openReactionsFor === m.id ? null : m.id);
    }, LONG_PRESS_MS);
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeStartX.current;
    const dy = t.clientY - swipeStartY.current;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress();

    if (swipeLocked.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        swipeLocked.current = "vertical";
        swipeStartX.current = null;
        swipeStartY.current = null;
        swipeEl.current = null;
        return;
      }
      swipeLocked.current = "horizontal";
      if (swipeEl.current) swipeEl.current.style.willChange = "transform";
    }

    if (swipeLocked.current === "vertical") return;
    const el = swipeEl.current;
    if (!el) return;
    if (dx <= 0) {
      el.style.transform = "";
      return;
    }
    el.style.transform = `translateX(${Math.min(SWIPE_MAX_PX, dx * SWIPE_DAMPING)}px)`;
  }

  function onTouchEnd() {
    clearLongPress();
    const el = swipeEl.current;
    const wasHorizontal = swipeLocked.current === "horizontal";
    const didLongPress = longPressFired.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeLocked.current = null;
    swipeEl.current = null;
    longPressFired.current = false;
    if (!el) return;
    let offset = 0;
    const mt = el.style.transform.match(/translateX\(([\d.]+)px\)/);
    if (mt) offset = parseFloat(mt[1]);
    el.style.transition = "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.transform = "";
    window.setTimeout(() => {
      el.style.transition = "";
      el.style.willChange = "";
    }, 250);
    if (!didLongPress && wasHorizontal && offset >= SWIPE_THRESHOLD_PX) {
      onReply(m);
      void tapFeedback();
    }
  }

  const isSameAuthor = prev && prev.author_handle === m.author_handle;
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

  const timeLabel = m._pending
    ? "Sending"
    : m._failed
      ? "Failed"
      : timeWithDate(m.created_at);

  const showReactions = openReactionsFor === m.id;
  const showBlock = !isMe && openBlockFor === m.author_handle;

  return (
    <div>
      {!sameDayAsPrev ? (
        <div className="chat-day-divider">{dayLabel(m.created_at)}</div>
      ) : null}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: "pan-y" }}
        className={`relative chat-row message-in ${isMe ? "chat-row-own" : ""} ${m._pending ? "opacity-70" : ""}`}
      >
        {!isMe && isGroupStart ? (
          <Link
            href={`/u/${encodeURIComponent(m.author_handle)}`}
            className="chat-row-avatar relative"
            aria-label={`View @${m.author_handle}`}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[0.8125rem] font-bold text-white"
              style={{ background: bg }}
            >
              {letter}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5">
              <PresenceDot state={presence} />
            </span>
          </Link>
        ) : (
          <div className="chat-row-spacer" />
        )}

        <div className={`chat-bubble ${isMe ? "chat-bubble-own" : "chat-bubble-other"}`}>
          {!isMe && isGroupStart ? (
            <>
              <Link
                href={`/u/${encodeURIComponent(m.author_handle)}`}
                className="chat-bubble-author"
              >
                {m.author_handle}
              </Link>
              {status ? (
                <StatusLine status={status} className="mb-1 !text-[0.75rem]" />
              ) : null}
            </>
          ) : null}

          {m.parent ? (
            <div
              className={`mb-1.5 flex max-w-full items-stretch gap-2 overflow-hidden rounded-lg border-l-2 px-2.5 py-1.5 ${isMe ? "border-white/60 bg-white/10" : "border-brand bg-ink/[0.04]"}`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-[0.7rem] font-semibold ${isMe ? "text-white/90" : "text-brand"}`}
                >
                  {m.parent.author_handle}
                </p>
                <p
                  className={`mt-0.5 line-clamp-2 text-[0.75rem] leading-snug ${isMe ? "text-white/80" : "text-muted"}`}
                >
                  {m.parent.body && m.parent.body.trim()
                    ? m.parent.body
                    : m.parent.audio_url
                      ? "Voice note"
                      : "(empty)"}
                </p>
              </div>
            </div>
          ) : null}

          {m.audio_url ? <VoiceNotePlayer src={m.audio_url} /> : null}

          {m.body ? (
            <MessageBody
              body={m.body}
              isOwn={isMe}
              mentionsMe={mentionsMe}
              fontId={fontId}
              colorId={colorId}
            />
          ) : null}

          {m._failed ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRetry(m._cid!)}
                className="rounded-lg bg-danger px-3 py-1 text-[0.7rem] font-semibold text-white"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => onDiscard(m._cid!)}
                className={`text-[0.7rem] ${isMe ? "text-white/70 hover:text-white" : "text-faint hover:text-ink"}`}
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
                  onClick={() => onReact(m.id, r.emoji)}
                  className={`rounded-full border px-2 py-0.5 text-[0.7rem] transition-colors ${isMe ? "border-white/30 bg-white/10 text-white hover:bg-white/20" : "border-border bg-surface text-ink hover:border-brand"}`}
                >
                  {r.emoji} {r.count}
                </button>
              ))}
            </div>
          ) : null}

          <span className={`chat-bubble-meta ${isMe ? "text-white/80" : "text-faint"}`}>
            {timeLabel}
            {isMe && !m._pending && !m._failed ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12.5 9.5 17 19 7" />
              </svg>
            ) : null}
          </span>
        </div>

        {showReactions ? (
          <>
            <div className="fixed inset-0 z-30" onClick={() => onToggleReactions(null)} />
            <div className={`absolute z-40 mt-1 flex items-center gap-1 rounded-full border border-border bg-surface p-1.5 shadow-card-hover ${isMe ? "left-3" : "right-3"}`}>
              {QUICK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact(m.id, e);
                    onToggleReactions(null);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[1rem] transition-colors hover:bg-ink/10"
                >
                  {e}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  onToggleReactions(null);
                  onReply(m);
                }}
                className="flex h-7 items-center rounded-full px-2 text-[0.7rem] font-semibold text-ink transition-colors hover:bg-ink/10"
              >
                Reply
              </button>
              {!isMe ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleReactions(null);
                      onReport(m.id, `@${m.author_handle}`);
                    }}
                    className="flex h-7 items-center rounded-full px-2 text-[0.7rem] font-semibold text-danger transition-colors hover:bg-danger-soft"
                  >
                    Report
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleReactions(null);
                      onToggleBlock(m.author_handle);
                    }}
                    className="flex h-7 items-center rounded-full px-2 text-[0.7rem] font-semibold text-danger transition-colors hover:bg-danger-soft"
                  >
                    Block
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {showBlock ? (
          <>
            <div className="fixed inset-0 z-30" onClick={() => onToggleBlock(null)} />
            <div className={`absolute z-40 mt-1 w-56 rounded-xl border border-border bg-surface p-2 shadow-card-hover ${isMe ? "left-3" : "right-3"}`}>
              <BlockButton
                handle={m.author_handle}
                className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft"
                onBlocked={(h) => {
                  onToggleBlock(null);
                  onBlocked(h);
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}