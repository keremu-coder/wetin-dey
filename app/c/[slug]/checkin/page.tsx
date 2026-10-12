"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CHECKIN_MAX_NOTE,
  CHECKIN_REASON_MAX,
  checkinAge,
  checkinExpiresIn,
  statusEmoji,
  statusLabel,
  type CheckinStatus
} from "@/lib/checkin";

type Member = {
  session_id: string;
  handle: string;
  role: string;
};

type Response = {
  session_id: string;
  status: string;
  note: string | null;
  created_at: string;
  handle: string;
};

type RequestInfo = {
  id: string;
  session_id: string;
  reason: string | null;
  created_at: string;
  expires_at: string;
  started_by_handle: string;
};

type ApiData = {
  community: { id: string; name: string };
  request: RequestInfo | null;
  responses: Response[];
  members: Member[];
  my_response: Response | null;
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

export default function CheckinPage({
  params
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [showStartSheet, setShowStartSheet] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/communities/${slug}/checkins`, {
        cache: "no-store"
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Load failed");
        setLoading(false);
        return;
      }
      setData(json as ApiData);
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void load();
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function respond(status: CheckinStatus) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/communities/${slug}/checkins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not record");
        setBusy(false);
        return;
      }
      if (navigator.vibrate) {
        try {
          navigator.vibrate(status === "help" ? [60, 40, 60] : 25);
        } catch {
          /* ignore */
        }
      }
      setShowNote(false);
      setNote("");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function startCheckin() {
    if (ownerBusy) return;
    setOwnerBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/communities/${slug}/checkins/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reasonDraft.trim() || undefined })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not start");
        setOwnerBusy(false);
        return;
      }
      setShowStartSheet(false);
      setReasonDraft("");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setOwnerBusy(false);
    }
  }

  const respondedIds = useMemo(
    () => new Set((data?.responses ?? []).map((r) => r.session_id)),
    [data]
  );

  const pending = useMemo(
    () => (data?.members ?? []).filter((m) => !respondedIds.has(m.session_id)),
    [data, respondedIds]
  );

  const hasResponded = data?.my_response != null;

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <p className="empty-state-text">Loading…</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link
          href={`/c/${slug}`}
          className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-brand"
        >
          ← Back to space
        </Link>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-soft p-6">
          <p className="text-[0.875rem] text-danger">
            {error || "Could not load check-in."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <Link
        href={`/c/${slug}`}
        className="font-mono text-[0.7rem] uppercase tracking-widest text-faint hover:text-brand"
      >
        ← {data.community.name}
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="font-serif text-[1.75rem] font-semibold leading-tight text-ink">
          Check in
        </h1>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
          A private rollcall for{" "}
          <strong className="text-ink">{data.community.name}</strong>. Nobody
          outside this space can see who answered or what they said.
        </p>
      </header>

      {data.request == null ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="text-[2.5rem]">🏠</div>
          <p className="mt-3 font-serif text-[1.15rem] font-semibold text-ink">
            No check-in active
          </p>
          <p className="mt-1 text-[0.875rem] text-muted">
            When there's a flood warning, long blackout, or unrest nearby, start
            a check-in and every member of this space gets asked.
          </p>

          <button
            type="button"
            onClick={() => setShowStartSheet(true)}
            className="mt-5 w-full rounded-2xl bg-brand px-5 py-3.5 font-serif text-[1rem] font-semibold text-white transition-colors hover:bg-brand-soft"
          >
            Start check-in
          </button>
          <p className="mt-2 text-[0.7rem] text-faint">
            Only the space owner can start one.
          </p>
        </div>
      ) : (
        <>
          {/* Active request banner */}
          <div className="rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
            <div className="flex items-start gap-3">
              <span className="text-[1.5rem]">🔔</span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-ink">
                  Check-in in progress
                </p>
                <p className="mt-0.5 text-[0.75rem] text-ink/70">
                  @{data.request.started_by_handle} ·{" "}
                  {checkinAge(data.request.created_at)} ·{" "}
                  {checkinExpiresIn(data.request.expires_at)}
                </p>
                {data.request.reason ? (
                  <p className="mt-1.5 text-[0.8125rem] italic text-ink/80">
                    &ldquo;{data.request.reason}&rdquo;
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Your response */}
          <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
            {hasResponded ? (
              <>
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                  Your reply
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[1.5rem]">
                    {statusEmoji(data.my_response!.status as CheckinStatus)}
                  </span>
                  <p className="text-[1.1rem] font-semibold text-ink">
                    {statusLabel(data.my_response!.status as CheckinStatus)}
                  </p>
                </div>
                {data.my_response!.note ? (
                  <p className="mt-2 text-[0.875rem] italic text-ink/80">
                    &ldquo;{data.my_response!.note}&rdquo;
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setNote(data.my_response!.note ?? "");
                    setShowNote(false);
                  }}
                  className="mt-3 text-[0.75rem] font-medium text-brand hover:underline"
                >
                  Change my reply
                </button>
              </>
            ) : (
              <>
                <p className="mb-3 text-center font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                  Tap to reply
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => respond("safe")}
                    disabled={busy}
                    className="flex flex-col items-center gap-1 rounded-2xl border-2 border-brand/40 bg-brand-tint py-4 transition-colors hover:border-brand disabled:opacity-50"
                  >
                    <span className="text-[1.75rem]">✅</span>
                    <span className="text-[0.8125rem] font-semibold text-ink">
                      Safe
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => respond("ok")}
                    disabled={busy}
                    className="flex flex-col items-center gap-1 rounded-2xl border-2 border-gold/40 bg-gold-soft py-4 transition-colors hover:border-gold disabled:opacity-50"
                  >
                    <span className="text-[1.75rem]">👌</span>
                    <span className="text-[0.8125rem] font-semibold text-ink">
                      Ok
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => respond("help")}
                    disabled={busy}
                    className="flex flex-col items-center gap-1 rounded-2xl border-2 border-danger/40 bg-danger-soft py-4 transition-colors hover:border-danger disabled:opacity-50"
                  >
                    <span className="text-[1.75rem]">🆘</span>
                    <span className="text-[0.8125rem] font-semibold text-ink">
                      Need help
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNote((v) => !v)}
                  className="mt-3 w-full text-center text-[0.7rem] font-medium text-brand hover:underline"
                >
                  {showNote ? "Hide note" : "Add a note (optional)"}
                </button>

                {showNote ? (
                  <textarea
                    value={note}
                    onChange={(e) =>
                      setNote(e.target.value.slice(0, CHECKIN_MAX_NOTE))
                    }
                    placeholder="e.g. Still at work, I'll reach home before dark"
                    rows={2}
                    className="mt-2 !min-h-[56px] text-[0.875rem]"
                  />
                ) : null}
              </>
            )}
          </div>

          {/* Who's responded */}
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-serif text-[1.1rem] font-semibold text-ink">
                Answers so far
              </h2>
              <p className="font-mono text-[0.7rem] text-faint">
                {data.responses.length}/{data.members.length}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              {data.responses.map((r, i) => {
                const status = r.status as CheckinStatus;
                const bg = avatarColor(r.handle);
                return (
                  <div
                    key={r.session_id}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      i !== 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold text-white"
                      style={{ background: bg }}
                    >
                      {r.handle.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[0.9375rem] font-medium text-ink">
                          @{r.handle}
                        </p>
                        <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                          {checkinAge(r.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.8125rem] text-ink">
                        {statusEmoji(status)} {statusLabel(status)}
                      </p>
                      {r.note ? (
                        <p className="mt-1 text-[0.75rem] italic text-muted">
                          &ldquo;{r.note}&rdquo;
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {pending.length > 0 ? (
                <>
                  <div className="border-t border-border bg-ink/[0.02] px-4 py-2">
                    <p className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                      Not yet
                    </p>
                  </div>
                  {pending.map((m) => {
                    const bg = avatarColor(m.handle);
                    return (
                      <div
                        key={m.session_id}
                        className="flex items-center gap-3 border-t border-border px-4 py-3"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold text-white opacity-50"
                          style={{ background: bg }}
                        >
                          {m.handle.charAt(0).toUpperCase()}
                        </div>
                        <p className="min-w-0 flex-1 truncate text-[0.9375rem] text-muted">
                          @{m.handle}
                        </p>
                        <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                          ⏳ pending
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : null}
            </div>
          </section>

          {/* Owner actions */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowStartSheet(true)}
              className="text-[0.75rem] font-medium text-brand hover:underline"
            >
              Start a new check-in (replaces this one)
            </button>
          </div>
        </>
      )}

      {error ? (
        <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      {/* Start sheet */}
      {showStartSheet ? (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/60 fade-in"
            onClick={() => setShowStartSheet(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[90] rounded-t-3xl border-t border-border bg-surface px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

            <h2 className="font-serif text-[1.25rem] font-semibold text-ink">
              Start a check-in
            </h2>
            <p className="mt-1 text-[0.875rem] text-muted">
              Every member of{" "}
              <strong className="text-ink">{data.community.name}</strong> will
              get a push notification asking them to reply.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reasonDraft}
                onChange={(e) =>
                  setReasonDraft(e.target.value.slice(0, CHECKIN_REASON_MAX))
                }
                placeholder="e.g. Flood warning in Lekki"
                maxLength={CHECKIN_REASON_MAX}
              />
              <p className="mt-1 text-right font-mono text-[0.65rem] text-faint">
                {reasonDraft.length}/{CHECKIN_REASON_MAX}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowStartSheet(false)}
                className="flex-1 rounded-xl border border-border-strong bg-paper py-3 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startCheckin}
                disabled={ownerBusy}
                className="flex-1 rounded-xl bg-brand py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-50"
              >
                {ownerBusy ? "Starting…" : "Send to everyone"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}