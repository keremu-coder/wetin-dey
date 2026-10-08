"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Small inline Block control. Fires /api/block, then either calls
 * onBlocked(handle) so the parent can hide the user's content locally,
 * or falls back to router.refresh() when no callback is provided.
 *
 * Shows a confirm step inline (no window.confirm) so it works inside
 * menus and bottom sheets without being blocked by the browser.
 */
export function BlockButton({
  handle,
  onBlocked,
  className,
  label = "Block"
}: {
  handle: string;
  onBlocked?: (handle: string) => void;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function doBlock() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, action: "block" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not block. Try again.");
        setBusy(false);
        return;
      }
      if (onBlocked) {
        onBlocked(handle);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Check your connection.");
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-danger/30 bg-danger-soft/50 p-2">
          <p className="text-[0.75rem] text-ink">
            Block @{handle}? You won&apos;t see their posts or messages.
          </p>
          {error ? (
            <p className="mt-1 text-[0.7rem] text-danger">{error}</p>
          ) : null}
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              disabled={busy}
              className="flex-1 rounded-md border border-border-strong bg-paper py-1 text-[0.7rem] font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doBlock}
              disabled={busy}
              className="flex-1 rounded-md bg-danger py-1 text-[0.7rem] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={
        className ??
        "block w-full rounded-lg px-3 py-2 text-left text-[0.8125rem] text-danger hover:bg-danger-soft"
      }
    >
      {label} @{handle}
    </button>
  );
}