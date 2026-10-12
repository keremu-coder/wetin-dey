"use client";

import Link from "next/link";

type ChatRowProps = {
  href: string;
  name: string;
  seed: string;
  emoji?: string | null;
  avatarUrl?: string | null;
  isPerson?: boolean;
  availability?: "R" | "A" | "D" | null;
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
  "var(--color-clay)",
  "var(--color-plum)",
  "var(--color-lagoon)"
];

function pickTile(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TILES[Math.abs(h) % TILES.length];
}

function initials(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVAILABILITY_STYLE: Record<"R" | "A" | "D", { bg: string; label: string }> = {
  R: { bg: "var(--color-accent)", label: "Available" },
  A: { bg: "var(--color-warn)", label: "Away" },
  D: { bg: "var(--color-clay)", label: "Do not disturb" }
};

const RECEIPT_STYLE = {
  sent: "bg-surface3 text-muted",
  delivered: "bg-primary-tint text-primary-ink",
  read: "bg-primary text-white"
} as const;

export function ChatRow({
  href, name, seed, emoji, avatarUrl, isPerson, availability,
  preview, previewPrefix, previewLive, voice, receipt,
  timestamp, unread = 0, muted, isLast
}: ChatRowProps) {
  const hasUnread = unread > 0 && !muted;
  const isMutedUnread = unread > 0 && muted;
  const avail = isPerson && availability ? AVAILABILITY_STYLE[availability] : null;
  const tile = pickTile(seed);
  const glyph = emoji ? emoji : initials(name);

  return (
    <Link
      href={href}
      className="group relative flex h-[68px] items-center gap-3.5 px-5 transition-colors active:bg-surface2"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="relative shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-[54px] w-[54px] rounded-full object-cover" />
        ) : (
          <div
            className="flex h-[54px] w-[54px] items-center justify-center rounded-full text-white shadow-sm"
            style={{
              background: emoji ? tile : tile,
              fontFamily: emoji ? undefined : "var(--font-space-grotesk), system-ui, sans-serif",
              fontSize: emoji ? 26 : 16,
              fontWeight: emoji ? undefined : 700
            }}
          >
            {glyph}
          </div>
        )}
        {avail ? (
          <span
            aria-label={avail.label}
            className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold leading-none text-white ring-2 ring-paper"
            style={{ background: avail.bg }}
          >
            {availability}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold leading-[1.375rem] text-ink">{name}</p>
          <span className={`shrink-0 text-[0.8125rem] leading-[1.125rem] ${hasUnread ? "font-semibold text-primary-ink" : "font-normal text-faint"}`}>
            {timestamp}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className={`flex min-w-0 flex-1 items-center gap-1.5 text-[0.9375rem] leading-[1.25rem] ${previewLive ? "text-primary-ink font-medium" : hasUnread ? "text-ink" : "text-muted"}`}>
            {receipt ? (
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${RECEIPT_STYLE[receipt]}`} aria-label={receipt}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5 9.5 17 19 7" />
                </svg>
              </span>
            ) : null}
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
          {hasUnread || isMutedUnread ? (
            <span
              className={`flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1.5 text-[0.75rem] font-semibold leading-none ${
                hasUnread ? "bg-primary text-white" : "bg-surface3 text-muted"
              }`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
      </div>

      {!isLast ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[86px] right-5 h-px bg-surface3 transition-opacity group-active:opacity-0"
        />
      ) : null}
    </Link>
  );
}