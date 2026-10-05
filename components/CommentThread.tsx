"use client";

import { useEffect, useRef, useState } from "react";

type Comment = {
  id: string;
  created_at: string;
  body: string;
  audio_url: string | null;
  transcript: string | null;
  author_handle: string | null;
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/${reportId}/comments`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: Comment[] = Array.isArray(d?.comments) ? d.comments : [];
        setComments(list);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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
        fd.set("audio", new File([audioBlob], "voice.webm", { type: "audio/webm" }));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      let res: Response;
      try {
        res = await fetch(`/api/reports/${reportId}/comments`, {
          method: "POST",
          body: fd,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const contentType = res.headers.get("content-type") ?? "";
      let json: { comment?: Comment; error?: string } = {};

      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        setError(`Server returned ${res.status}. Try again.`);
        setBusy(false);
        return;
      }

      if (!res.ok) {
        setError(json.error ?? `Comment no send. Code: ${res.status}`);
        setBusy(false);
        return;
      }

      if (json.comment) {
        setComments((prev) => [...prev, json.comment!]);
      }
      setBody("");
      clearAudio();
      setBusy(false);
    } catch (e) {
      console.error("Comment submit failed:", e);
      const msg = (e as Error).name === "AbortError"
        ? "Request timed out. Check your network and try again."
        : "Network error. Try again.";
      setError(msg);
      setBusy(false);
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

  const safeComments = Array.isArray(comments) ? comments : [];

  return (
    <section className="mt-10">
      <h2 className="mb-4 font-serif text-[1.35rem] font-semibold text-ink">
        Wetin people dey talk
      </h2>

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-card">
        {audioPreviewUrl ? (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-accent-soft p-3">
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
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[0.875rem] font-medium text-white shadow-button transition-all hover:bg-accent-deep"
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
            className="inline-flex items-center gap-2 rounded-xl bg-warm px-4 py-2 text-[0.875rem] font-medium text-white shadow-button transition-all hover:bg-warm-deep disabled:opacity-60"
          >
            {busy ? "Dey send…" : "Send"}
          </button>
        </div>

        {error ? (
          <p className="mt-2 text-[0.8125rem] text-danger">{error}</p>
        ) : null}
      </div>

      {safeComments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-8 text-center">
          <p className="text-[0.9375rem] text-muted">
            No comment yet. Be the first.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {safeComments.map((c) => {
            const handle = c.author_handle ?? "Anonymous";
            const letter = handle.charAt(0).toUpperCase();
            const bg = avatarColor(c.author_handle ?? c.id);
            const muted = (c.score ?? 0) <= -6;
            return (
              <article
                key={c.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-card"
              >
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
                      <span className="font-mono text-[0.7rem] uppercase text-faint">
                        {timeAgo(c.created_at)}
                      </span>
                    </div>

                    {muted ? (
                      <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                        ⚠️ Community marked this as harmful. Voice muted.
                      </p>
                    ) : null}

                    {c.audio_url ? (
                      <div className="mt-2">
                        <audio src={c.audio_url} controls className="h-8 w-full max-w-xs" />
                      </div>
                    ) : null}

                    {c.body && c.body !== "(voice note)" ? (
                      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/90">
                        {c.body}
                      </p>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => vote(c.id, "up")}
                        className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:bg-accent-soft hover:text-accent-deep"
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
                      {(c.score ?? 0) !== 0 ? (
                        <span className="text-[0.7rem] text-faint">
                          score {(c.score ?? 0) > 0 ? "+" : ""}
                          {c.score ?? 0}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}