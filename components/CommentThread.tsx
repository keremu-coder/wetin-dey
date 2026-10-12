"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import {
  pickRecorderFormat,
  actualMime,
  extFromType
} from "@/lib/voice-recorder";
import { BlockButton } from "./BlockButton";
import { MessageBody } from "./MessageBody";

// Lazy-loaded â€” the flag sheet is only shown when the user taps report.
const FlagSheet = nextDynamic(
  () => import("./FlagSheet").then((m) => m.FlagSheet),
  { ssr: false }
);

type Comment = {
  id: string;
  created_at: string;
  body: string;
  audio_url: string | null;
  transcript: string | null;
  parent_id: string | null;
  author_handle: string | null;
  author_color: string | null;
  author_font: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric"
  });
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const colors = [
    "bg-[#C0392B]",
    "bg-[#D97706]",
    "bg-[#1F7A4D]",
    "bg-[#7C3AED]",
    "bg-[#0E7490]",
    "bg-[#BE185D]"
  ];
  return colors[Math.abs(h) % colors.length];
}

export function CommentThread({ reportId }: { reportId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [blockedHandles, setBlockedHandles] = useState<Set<string>>(new Set());
  const [flagTarget, setFlagTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/${reportId}/comments`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setComments(Array.isArray(d?.comments) ? d.comments : []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const { topLevel, repliesByParent } = useMemo(() => {
    const top: Comment[] = [];
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.author_handle && blockedHandles.has(c.author_handle)) continue;
      if (c.parent_id) {
        const list = map.get(c.parent_id) ?? [];
        list.push(c);
        map.set(c.parent_id, list);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesByParent: map };
  }, [comments, blockedHandles]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const format = pickRecorderFormat();

      let mr: MediaRecorder;
      try {
        mr = format.mimeType
          ? new MediaRecorder(stream, { mimeType: format.mimeType })
          : new MediaRecorder(stream);
      } catch {
        mr = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const mime = actualMime(mr, format.mimeType);
        const blob = new Blob(chunksRef.current, { type: mime });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 59) {
            stopRecording();
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone no work. Check permission.");
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function clearAudio() {
    setAudioBlob(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setRecordSeconds(0);
  }

  async function submit() {
    if (!body.trim() && !audioBlob) {
      setError("Type something or record a voice note.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      const fd = new FormData();
      fd.set("body", body.trim());
      if (audioBlob) {
        const ext = extFromType(audioBlob.type);
        fd.set(
          "audio",
          new File([audioBlob], `voice.${ext}`, {
            type: audioBlob.type || "audio/webm"
          })
        );
      }

      const res = await fetch(`/api/reports/${reportId}/comments`, {
        method: "POST",
        body: fd
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Comment no send.");
        setBusy(false);
        return;
      }

      setComments((prev) => [...prev, json.comment]);
      setBody("");
      clearAudio();
      setBusy(false);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  async function submitReply(parentId: string) {
    if (!replyBody.trim()) return;
    setReplyBusy(true);

    try {
      const fd = new FormData();
      fd.set("body", replyBody.trim());
      fd.set("parent_id", parentId);

      const res = await fetch(`/api/reports/${reportId}/comments`, {
        method: "POST",
        body: fd
      });

      const json = await res.json();
      if (!res.ok) {
        setReplyBusy(false);
        return;
      }

      setComments((prev) => [...prev, json.comment]);
      setReplyBody("");
      setReplyTo(null);
      setReplyBusy(false);
    } catch {
      setReplyBusy(false);
    }
  }

  async function vote(commentId: string, v: "up" | "down") {
    try {
      const res = await fetch(`/api/comments/${commentId}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vote: v })
      });
      if (!res.ok) return;
      const json = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                upvotes: json.upvotes ?? c.upvotes,
                downvotes: json.downvotes ?? c.downvotes,
                score: json.score ?? c.score
              }
            : c
        )
      );
    } catch {
      /* ignore */
    }
  }

  function renderComment(c: Comment, isReply = false) {
    const handle = c.author_handle ?? "Anonymous";
    const letter = handle.charAt(0).toUpperCase();
    const bg = avatarColor(c.author_handle ?? c.id);
    const muted = (c.score ?? 0) <= -6;
    const replies = repliesByParent.get(c.id) ?? [];
    const isReplying = replyTo === c.id;

    return (
      <div key={c.id} className={isReply ? "ml-8 mt-3" : ""}>
        <article className="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg} text-[0.8rem] font-semibold text-white`}
            >
              {letter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[0.875rem] font-medium text-ink">
                  @{handle}
                </span>
                <span className="text-[0.7rem] text-faint">
                  {timeAgo(c.created_at)}
                </span>
              </div>

              {muted ? (
                <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                  ⚠️ Community marked this as harmful.
                </p>
              ) : null}

              {c.audio_url ? (
                <div className="mt-2">
                  <audio
                    src={c.audio_url}
                    controls
                    className="h-8 w-full max-w-xs"
                  />
                </div>
              ) : null}

              {c.body && c.body !== "(voice note)" ? (
                <div className="mt-2">
                  <MessageBody
                    body={c.body}
                    isOwn={false}
                    fontId={c.author_font}
                    colorId={c.author_color}
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => vote(c.id, "up")}
                  className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:bg-brand-tint hover:text-brand"
                >
                  👍 {c.upvotes ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => vote(c.id, "down")}
                  className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  👎 {c.downvotes ?? 0}
                </button>
                {!isReply ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(isReplying ? null : c.id);
                      setReplyBody("");
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:bg-ink/10 hover:text-ink"
                  >
                    ↩️ Reply
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setFlagTarget({ id: c.id, label: `@${handle}` })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  aria-label="Report this comment"
                  title="Report"
                >
                  🚩
                </button>
                <BlockButton
                  handle={handle}
                  className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  label="Block"
                  onBlocked={(h) => {
                    setBlockedHandles((prev) => {
                      const next = new Set(prev);
                      next.add(h);
                      return next;
                    });
                  }}
                />
                {(c.score ?? 0) !== 0 ? (
                  <span className="text-[0.7rem] text-faint">
                    score {(c.score ?? 0) > 0 ? "+" : ""}
                    {c.score ?? 0}
                  </span>
                ) : null}
              </div>

              {isReplying ? (
                <div className="mt-3 rounded-xl border border-border bg-paper p-3">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to @${handle}…`}
                    rows={2}
                    className="mb-2 w-full rounded-lg border border-border-strong bg-surface p-2 text-[0.875rem]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        setReplyBody("");
                      }}
                      className="rounded-lg px-3 py-1.5 text-[0.75rem] text-muted hover:bg-ink/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReply(c.id)}
                      disabled={replyBusy || !replyBody.trim()}
                      className="rounded-lg bg-brand px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-all hover:bg-brand-soft disabled:opacity-50"
                    >
                      {replyBusy ? "…" : "Reply"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </article>

        {replies.map((r) => renderComment(r, true))}
      </div>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="mb-4 font-serif text-[1.35rem] font-semibold text-ink">
        Comments
      </h2>

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-card">
        {audioPreviewUrl ? (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-brand-tint p-3">
            <audio src={audioPreviewUrl} controls className="h-8 flex-1" />
            <button
              type="button"
              onClick={clearAudio}
              className="rounded-lg px-2 py-1 text-[0.75rem] font-medium text-danger hover:bg-danger-soft"
            >
              Remove
            </button>
          </div>
        ) : null}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            audioBlob
              ? "Add a note (optional)…"
              : "Type your comment or record a voice note…"
          }
          rows={3}
          className="mb-3 w-full rounded-xl border border-border-strong bg-paper p-3 text-[0.9375rem]"
        />

        <div className="flex flex-wrap items-center gap-2">
          {!recording && !audioBlob ? (
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-[0.875rem] font-medium text-white shadow-button transition-all hover:bg-brand-soft"
            >
              🎙️ Record voice
            </button>
          ) : null}

          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-[0.875rem] font-medium text-white"
            >
              ■ Stop ({recordSeconds}s)
            </button>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={busy || recording}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-[0.875rem] font-medium text-white shadow-button transition-all hover:bg-brand-soft disabled:opacity-60"
          >
            {busy ? "Dey send…" : "Send"}
          </button>
        </div>

        {error ? (
          <p className="mt-2 text-[0.8125rem] text-danger">{error}</p>
        ) : null}
      </div>

      {topLevel.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <p className="empty-state-title">No comments yet</p>
          <p className="empty-state-text">Be the first to say something.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topLevel.map((c) => renderComment(c))}
        </div>
      )}

      {flagTarget ? (
        <FlagSheet
          targetType="comment"
          targetId={flagTarget.id}
          targetLabel={flagTarget.label}
          onClose={() => setFlagTarget(null)}
        />
      ) : null}
    </section>
  );
}