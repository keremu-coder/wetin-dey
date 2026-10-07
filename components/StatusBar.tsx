"use client";

import { useEffect, useState } from "react";
import { STATUS_MAX_LENGTH } from "@/lib/status";
import {
  AVAILABILITY_CHOICES,
  computePresence,
  presenceDef,
  presenceLine,
  type AvailabilityId
} from "@/lib/presence";
import { unlockAudio, vibrate } from "@/lib/sounds";

type Me = {
  id: string;
  handle: string;
  availability: AvailabilityId;
  status_line: string | null;
  last_seen_at: string | null;
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
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [draftStatus, setDraftStatus] = useState("");
  const [draftAvailability, setDraftAvailability] =
    useState<AvailabilityId>("auto");
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
        const res = await fetch(
          `/api/settings/status?session_id=${encodeURIComponent(who.id)}`,
          { cache: "no-store" }
        );
        let availability: AvailabilityId = "auto";
        let statusLine: string | null = null;
        if (res.ok) {
          const j = await res.json();
          availability = (j?.availability ?? "auto") as AvailabilityId;
          statusLine =
            typeof j?.status_line === "string" ? j.status_line : null;
        }
        if (cancelled) return;
        setMe({
          id: who.id,
          handle: who.handle,
          availability,
          status_line: statusLine,
          last_seen_at: new Date().toISOString()
        });
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

  function openSheet() {
    if (!me) return;
    unlockAudio();
    setDraftStatus(me.status_line ?? "");
    setDraftAvailability(me.availability);
    setError("");
    setSheetOpen(true);
  }

  async function save() {
    if (!me) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: me.id,
          status_line: draftStatus,
          availability: draftAvailability
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not save");
        return;
      }
      setMe({
        ...me,
        availability: draftAvailability,
        status_line:
          typeof json.status_line === "string"
            ? json.status_line
            : json.status_line === null
              ? null
              : me.status_line
      });
      vibrate(20);
      setSheetOpen(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !me) return null;

  const bg = avatarColor(me.handle);
  const presenceState = computePresence(me.availability, me.last_seen_at);
  const def = presenceDef(presenceState);
  const line = presenceLine(presenceState, me.status_line);

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-accent/50"
      >
        <div className="relative shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-[1.1rem] font-semibold text-white"
            style={{ background: bg }}
          >
            {me.handle.charAt(0).toUpperCase()}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 inline-block rounded-full border-2 border-paper"
            style={{
              background: def.color,
              width: 14,
              height: 14
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            @{me.handle}
          </p>
          <p className="mt-0.5 truncate text-[0.9375rem] leading-snug text-ink">
            {line}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border-strong bg-paper px-3 py-1 text-[0.7rem] font-medium text-ink">
          Edit
        </span>
      </button>

      {sheetOpen ? (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/60 fade-in"
            onClick={() => setSheetOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[90] rounded-t-3xl border-t border-border bg-surface px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

            <h2 className="font-serif text-[1.25rem] font-semibold text-ink">
              Your status
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              What people see under your name — availability + a short line.
              Like BBM.
            </p>

            <p className="mt-5 mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
              Availability
            </p>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABILITY_CHOICES.map((c) => {
                const selected = draftAvailability === c.id;
                const previewState = computePresence(
                  c.id,
                  new Date().toISOString()
                );
                const dot = presenceDef(previewState).color;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDraftAvailability(c.id)}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-accent bg-accent-soft/40"
                        : "border-border-strong hover:bg-ink/5"
                    }`}
                  >
                    <span
                      className="inline-block rounded-full border-2 border-paper"
                      style={{ background: dot, width: 12, height: 12 }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-semibold text-ink">
                        {c.label}
                      </p>
                      <p className="truncate text-[0.65rem] text-muted">
                        {c.hint}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
              Status line
            </p>
            <textarea
              value={draftStatus}
              onChange={(e) =>
                setDraftStatus(e.target.value.slice(0, STATUS_MAX_LENGTH))
              }
              placeholder="Wetin dey your mind?"
              rows={2}
              maxLength={STATUS_MAX_LENGTH}
              className="!min-h-[56px] text-[0.9375rem]"
            />
            <p className="mt-1 text-right font-mono text-[0.65rem] text-faint">
              {draftStatus.length}/{STATUS_MAX_LENGTH}
            </p>

            {error ? (
              <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
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