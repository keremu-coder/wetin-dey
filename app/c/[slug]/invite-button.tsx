"use client";

import { useState } from "react";
import { InviteSheet } from "@/components/InviteSheet";

export function InviteButton({
  slug,
  name,
  emoji
}: {
  slug: string;
  name: string;
  emoji: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-ink/5"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
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

      {open ? (
        <InviteSheet
          slug={slug}
          name={name}
          emoji={emoji}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}