"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { vibrate } from "@/lib/sounds";

export function ModerateActions({
  kind,
  targetId
}: {
  kind: "report" | "reply";
  targetId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  async function act(action: "approve" | "reject") {
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/admin/moderate-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          target_id: targetId,
          action,
          reason: action === "reject" ? reason.trim() : undefined
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Action failed");
        return;
      }
      vibrate(25);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  if (showReject) {
    return (
      <div className="space-y-2">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 300))}
          placeholder="Reason for rejection (visible to the submitter)"
          rows={2}
          className="!min-h-[56px] text-[0.8125rem]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowReject(false);
              setReason("");
            }}
            className="flex-1 rounded-lg border border-border-strong bg-paper py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={busy != null}
            className="flex-1 rounded-lg bg-danger py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {busy === "reject" ? "Rejecting…" : "Confirm reject"}
          </button>
        </div>
        {error ? (
          <p className="text-[0.75rem] text-danger">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => act("approve")}
        disabled={busy != null}
        className="flex-1 rounded-lg bg-accent py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
      >
        {busy === "approve" ? "Approving…" : "✓ Approve"}
      </button>
      <button
        type="button"
        onClick={() => setShowReject(true)}
        disabled={busy != null}
        className="flex-1 rounded-lg border border-border-strong bg-paper py-2 text-[0.8125rem] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
      >
        Reject
      </button>
      {error ? (
        <p className="text-[0.75rem] text-danger">{error}</p>
      ) : null}
    </div>
  );
}