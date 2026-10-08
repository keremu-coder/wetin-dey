"use client";

import { useState } from "react";
import { FlagSheet } from "./FlagSheet";

/**
 * The ●●● menu shown on a user's profile (when it's not your own).
 * Offers Report and Block.
 */
export function ProfileActions({
  profileId,
  handle
}: {
  profileId: string;
  handle: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function blockUser() {
    if (busy) return;
    if (!confirm(`Block @${handle}? You won't see their posts or messages.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, action: "block" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Could not block. Try again.");
        setBusy(false);
        return;
      }
      setMenuOpen(false);
      window.location.reload();
    } catch {
      alert("Could not block. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-surface text-faint transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label="More options"
        >
          •••
        </button>

        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-surface p-1 shadow-card-hover">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setFlagOpen(true);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-ink hover:bg-ink/5"
              >
                Report @{handle}
              </button>
              <button
                type="button"
                onClick={blockUser}
                disabled={busy}
                className="block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft disabled:opacity-60"
              >
                {busy ? "Dey block…" : `Block @${handle}`}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {flagOpen ? (
        <FlagSheet
          targetType="user"
          targetId={profileId}
          targetLabel={`@${handle}`}
          onClose={() => setFlagOpen(false)}
        />
      ) : null}
    </>
  );
}