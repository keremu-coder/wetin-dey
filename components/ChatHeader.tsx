"use client";

import Link from "next/link";

export type ChatHeaderProps = {
  slug: string;
  name: string;
  emoji: string;
  avatarUrl: string | null;
  onlineHandles: string[];
  memberCount: number;
  onOpenMembers: () => void;
  onOpenVoice: () => void;
};

export function ChatHeader({
  slug,
  name,
  emoji,
  avatarUrl,
  onlineHandles,
  memberCount,
  onOpenMembers,
  onOpenVoice
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border bg-paper/90 px-3 py-2.5 backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href={`/c/${slug}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand transition-colors hover:bg-ink/5"
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
          onClick={onOpenMembers}
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
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[0.9375rem] font-semibold text-ink">
              {name}
            </p>
            <p className="truncate text-[0.65rem] text-faint">
              {onlineHandles.length > 0
                ? onlineHandles.slice(0, 2).join(", ") +
                  (onlineHandles.length > 2
                    ? ` +${onlineHandles.length - 2}`
                    : "")
                : `${memberCount} members`}
            </p>
          </div>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenVoice}
          className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand px-3.5 text-white transition-transform active:scale-95"
          aria-label="Voice & Games"
        >
          <span className="text-[1.1rem]">🎙️</span>
          <span className="text-[0.75rem] font-semibold">Games</span>
        </button>
        <button
          type="button"
          onClick={onOpenMembers}
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
  );
}