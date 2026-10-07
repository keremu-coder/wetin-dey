"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartDMButton({ handle }: { handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/dm/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_handle: handle })
      });
      const json = await res.json();
      if (!res.ok || !json?.thread_id) {
        setError(json?.error ?? "Could not open DM");
        return;
      }
      router.push(`/inbox/${json.thread_id}`);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-60"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {busy ? "Opening…" : "Message"}
      </button>
      {error ? (
        <p className="mt-2 text-[0.75rem] text-danger">{error}</p>
      ) : null}
    </>
  );
}