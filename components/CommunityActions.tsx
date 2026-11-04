"use client";

import { useState } from "react";
import { FlagSheet } from "./FlagSheet";

/**
 * The ●●● menu shown on a Space's header (only for non-owners).
 * Offers Report this space. Block/leave are handled elsewhere.
 */
export function CommunityActions({
  communityId,
  communityName
}: {
  communityId: string;
  communityName: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);

  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/5 hover:text-ink"
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
                Report this space
              </button>
            </div>
          </>
        ) : null}
      </div>

      {flagOpen ? (
        <FlagSheet
          targetType="community"
          targetId={communityId}
          targetLabel={`this space (${communityName})`}
          onClose={() => setFlagOpen(false)}
        />
      ) : null}
    </>
  );
}