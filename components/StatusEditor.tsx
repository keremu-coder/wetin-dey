"use client";

import { useEffect, useState } from "react";
import { STATUS_MAX_LENGTH } from "@/lib/status";
import { unlockAudio, vibrate } from "@/lib/sounds";

export function StatusEditor({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState("");
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings/status?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const s = typeof d?.status_line === "string" ? d.status_line : "";
        setStatus(s);
        setOriginal(s);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function save() {
    unlockAudio();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, status_line: status })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        setSaving(false);
        return;
      }
      setOriginal(json.status_line ?? "");
      setStatus(json.status_line ?? "");
      setSaved(true);
      vibrate(25);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function clear() {
    unlockAudio();
    setStatus("");
  }

  const dirty = status !== original;
  const remaining = STATUS_MAX_LENGTH - status.length;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-[0.7rem] text-faint">
          Status line
        </p>
        <p className="text-[0.65rem] text-faint">
          {remaining} left
        </p>
      </div>

      <textarea
        value={status}
        onChange={(e) => setStatus(e.target.value.slice(0, STATUS_MAX_LENGTH))}
        placeholder="How you dey? Wetin dey happen?"
        rows={2}
        maxLength={STATUS_MAX_LENGTH}
        disabled={loading}
        className="mt-2 w-full resize-none !min-h-[64px] text-[0.9375rem]"
      />

      <p className="mt-1 text-[0.75rem] text-muted">
        Shows under your name everywhere — chat, profile, member lists. Like
        
      </p>

      {error ? (
        <p className="mt-2 text-[0.75rem] text-danger">{error}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={loading || saving || !dirty}
          className="rounded-xl bg-brand px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-40"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
        {status.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            disabled={loading || saving}
            className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-40"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}