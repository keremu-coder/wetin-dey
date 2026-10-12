"use client";

import Link from "next/link";
import { Alama } from "@/components/Alama";

export type ChatSignal =
  | "ready"
  | "away"
  | "dnd"
  | "offline"
  | "live"
  | "quiet";

type ChatRowProps = {
  href: string;
  name: string;
  seed: string;
  emoji?: string | null;
  avatarUrl?: string | null;
  signal?: ChatSignal;
  preview: string;
  previewPrefix?: string;
  previewLive?: boolean;
  voice?: boolean;
  receipt?: "sent" | "delivered" | "read";
  timestamp: string;
  unread?: number;
  muted?: boolean;
  isLast?: boolean;
};

const TILES = [
  "var(--color-leaf)",
  "var(--color-adire)",
  "var(--color-zobo)",
  "var(--color-clay)"
];

function pickTile(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TILES[Math.abs(h) % TILES.length];
}

const SIGNAL_LETTER: Record<"ready" | "away" | "dnd", { bg: string; letter: string; label: string }> = {
  ready: { bg: "var(--color-signal)", letter: "R", label: "Ready" },
  away: { bg: "var(--color-warn)", letter: "A", label: "Away" },
  dnd: { bg: "var(--color-clay)", letter: "D", label: "Busy" }
};

const RECEIPT_STYLE = {
  sent: "bg-surface3 text-muted",
  delivered: "bg-primary-tint text-primary-ink",
  read: "bg-primary text-white"
} as const;

/**
 * Signal badge sits in its own column between the avatar and the text
 * block. Both name and preview start after it, so they line up cleanly.
 */
function SignalBadge({ signal }: { signal?: ChatSignal }) {
  if (signal === "live") {
    return (
      <span className="flex w-5 shrink-0 items-center justify-center" aria-label="Active now">
        <span className="dey-pulse h-[10px] w-[10px] rounded-full bg-signal" />
      </span>
    );
  }
  if (signal === "quiet" || signal === "offline") {
    return (
      <span className="flex w-5 shrink-0 items-center justify-center" aria-hidden>
        <span className="h-[9px] w-[9px] rounded-full bg-[#8B9A91] dark:bg-[#6B7A70]" />
      </span>
    );
  }
  if (signal === "ready" || signal === "away" || signal === "dnd") {
    const s = SIGNAL_LETTER[signal];
    return (
      <span
        aria-label={s.label}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white"
        style={{ background: s.bg }}
      >
        {s.letter}
      </span>
    );
  }
  return <span className="w-5 shrink-0" aria-hidden />;
}

export function ChatRow({
  href, name, seed, emoji, avatarUrl, signal,
  preview, previewPrefix, previewLive, voice, receipt,
  timestamp, unread = 0, muted, isLast
}: ChatRowProps) {
  const hasUnread = unread > 0 && !muted;

  return (
    <Link
      href={href}
      className="group relative flex h-[76px] items-center gap-3 px-5 transition-colors active:bg-surface2"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-[54px] w-[54px] rounded-full object-cover" />
        ) : emoji ? (
          <div
            className="flex h-[54px] w-[54px] items-center justify-center rounded-full text-white shadow-sm"
            style={{ background: pickTile(seed), fontSize: 22 }}
          >
            {emoji}
          </div>
        ) : (
          <Alama seed={seed} size={54} />
        )}
      </div>

      <SignalBadge signal={signal} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold leading-[1.375rem] text-ink">{name}</p>
          <span className={`shrink-0 text-[0.75rem] leading-[1.125rem] ${hasUnread ? "font-semibold text-primary-ink" : "font-normal text-faint"}`}>
            {timestamp}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <p className={`flex min-w-0 flex-1 items-center gap-1.5 text-[0.875rem] leading-[1.25rem] ${previewLive ? "text-primary-ink font-medium" : hasUnread ? "text-ink" : "text-muted"}`}>
            {voice ? (
              <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            ) : null}
            <span className="min-w-0 truncate">
              {previewPrefix ? <span className="text-muted">{previewPrefix}</span> : null}
              {preview}
            </span>
          </p>
          {receipt ? (
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${RECEIPT_STYLE[receipt]}`} aria-label={receipt}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5 9.5 17 19 7" />
              </svg>
            </span>
          ) : null}
          {hasUnread ? (
            <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.75rem] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
      </div>

      {!isLast ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[100px] right-5 h-px bg-surface3 transition-opacity group-active:opacity-0"
        />
      ) : null}
    </Link>
  );
}