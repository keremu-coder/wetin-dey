"use client";

import { useState } from "react";

export function FollowButton({
  handle,
  initialFollowing,
  initialFollowerCount,
  disabled,
  compact = false
}: {
  handle: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  disabled?: boolean;
  /**
   * Compact mode: small pill, no follower count. Used in list views
   * (followers, following, search results) where the count would be
   * noisy and possibly inaccurate (we don't fetch per-row counts).
   */
  compact?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowerCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy || disabled) return;
    setBusy(true);
    const nextAction = following ? "unfollow" : "follow";

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, action: nextAction })
      });
      const json = (await res.json()) as {
        ok?: boolean;
        follower_count?: number;
        error?: string;
      };
      if (res.ok && json.ok) {
        setFollowing(nextAction === "follow");
        if (typeof json.follower_count === "number") {
          setCount(json.follower_count);
        }
      }
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy || disabled}
        className={`inline-flex items-center rounded-full px-3 py-1 text-[0.75rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          following
            ? "border border-border-strong bg-surface text-ink hover:bg-ink/5"
            : "bg-accent text-white hover:bg-accent-deep"
        }`}
      >
        {busy ? "…" : following ? "Following" : "Follow"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[0.875rem] font-medium transition-all ${
        following
          ? "border border-border-strong bg-surface text-ink hover:bg-ink/5"
          : "bg-accent text-white shadow-button hover:bg-accent-deep"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {busy ? "…" : following ? "Following" : "Follow"}
      <span
        className={`font-mono text-[0.75rem] ${
          following ? "text-faint" : "text-white/80"
        }`}
      >
        {count}
      </span>
    </button>
  );
}