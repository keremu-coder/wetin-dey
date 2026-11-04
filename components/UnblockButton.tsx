"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnblockButton({ handle }: { handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unblock() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, action: "unblock" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not unblock. Try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={unblock}
        disabled={busy}
        className="rounded-xl border border-border-strong bg-surface px-5 py-2.5 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-ink/5 disabled:opacity-60"
      >
        {busy ? "Unblocking…" : `Unblock @${handle}`}
      </button>
      {error ? (
        <p className="mt-2 text-[0.8125rem] text-danger">{error}</p>
      ) : null}
    </div>
  );
}