"use client";

import { useEffect, useState } from "react";
import { STATUS_MAX_LENGTH } from "@/lib/status";
import { unlockAudio, vibrate } from "@/lib/sounds";

type WhoAmI = {
  id: string;
  handle: string;
};

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const colors = [
    "#C0392B",
    "#D97706",
    "#1F7A4D",
    "#7C3AED",
    "#0E7490",
    "#BE185D",
    "#4D7C0F",
    "#A16207"
  ];
  return colors[Math.abs(h) % colors.length];
}

export function StatusBar() {
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const whoRes = await fetch("/api/whoami");
        if (!whoRes.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const who = (await whoRes.json()) as { id?: string; handle?: string };
        if (!who.id || !who.handle) {
          if (!cancelled) setLoading(false);
          return;
        }
        if (cancelled) return;
        setMe({ id: who.id, handle: who.handle });

        const res = await fetch(
          `/api/settings/status?session_id=${encodeURIComponent(who.id)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const j = await res.json();
          if (!cancelled) {
            setStatus(typeof j?.status_line === "string" ? j.status_line : null);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openEditor() {
    unlockAudio();
    setDraft(status ?? "");
    setError("");
    setEditing(true);
  }

  async function save() {
    if (!me) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: me.id, status_line: draft })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        return;
      }
      setStatus(json.status_line ?? null);
      vibrate(20);
      setEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !me) return null;

  const bg = avatarColor(me.handle);

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-accent/50"
      >
        <div className="relative shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-[1.1rem] font-semibold text-white"
            style={{ background: bg }}
          >
            {me.handle.charAt(0).toUpperCase()}
          </div>
          {status ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface bg-accent text-[0.55rem] text-white">
              ✓
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            @{me.handle}
          </p>
          {status ? (
            <p className="mt-0.5 truncate text-[0.9375rem] italic leading-snug text-ink">
              {status}
            </p>
          ) : (
            <p className="mt-0.5 text-[0.9375rem] leading-snug text-muted">
              Tap to set your status…
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-border-strong bg-paper px-3 py-1 text-[0.7rem] font-medium text-ink">
          {status ? "Edit" : "Set"}
        </span>
      </button>

      {editing ? (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/60 fade-in"
            onClick={() => setEditing(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[90] rounded-t-3xl border-t border-border bg-surface px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

            <h2 className="font-serif text-[1.25rem] font-semibold text-ink">
              Set your status
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              A short line under your name everywhere — chat, spaces, your
              profile. Like BBM.
            </p>

            <textarea
              value={draft}
              onChange={(e) =>
                setDraft(e.target.value.slice(0, STATUS_MAX_LENGTH))
              }
              placeholder="Wetin dey your mind?"
              rows={2}
              autoFocus
              maxLength={STATUS_MAX_LENGTH}
              className="mt-4 !min-h-[64px] text-[0.9375rem]"
            />
            <p className="mt-1 text-right font-mono text-[0.65rem] text-faint">
              {draft.length}/{STATUS_MAX_LENGTH}
            </p>

            {error ? (
              <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {status ? (
                <button
                  type="button"
                  onClick={() => setDraft("")}
                  disabled={saving}
                  className="rounded-xl border border-border-strong bg-paper px-4 py-3 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="ml-auto rounded-xl border border-border-strong bg-paper px-4 py-3 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-accent px-5 py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}