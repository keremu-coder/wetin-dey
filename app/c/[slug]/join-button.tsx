"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommunityJoinButton({
  slug,
  initialMember,
  isOwner
}: {
  slug: string;
  initialMember: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [member, setMember] = useState(initialMember);
  const [busy, setBusy] = useState(false);

  if (isOwner) {
    return (
      <span className="rounded-xl border border-border-strong px-4 py-2 text-[0.8125rem] font-medium text-muted">
        You own this space
      </span>
    );
  }

  async function toggle() {
    setBusy(true);
    const action = member ? "leave" : "join";
    const res = await fetch(`/api/communities/${slug}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    });
    if (res.ok) {
      setMember(!member);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-xl px-4 py-2 text-[0.8125rem] font-semibold transition-colors disabled:opacity-60 ${
        member
          ? "border border-border-strong bg-surface text-ink hover:bg-ink/5"
          : "bg-accent text-white hover:bg-accent-deep"
      }`}
    >
      {busy ? "…" : member ? "Leave" : "Join"}
    </button>
  );
}