"use client";

import { useEffect, useRef, useState } from "react";
import {
  BROADCAST_MAX_SECONDS,
  BROADCAST_TITLE_MAX
} from "@/lib/broadcasts";
import {
  pickRecorderFormat,
  actualMime,
  extFromType
} from "@/lib/voice-recorder";
import { unlockAudio, vibrate } from "@/lib/sounds";

export function BroadcastRecorder({
  slug,
  onSent,
  onClose
}: {
  slug: string;
  onSent: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function start() {
    setError("");
    unlockAudio();
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

      recorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const mime = actualMime(mr, format.mimeType);
        const b = new Blob(chunksRef.current, { type: mime });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      setRecording(true);
      setSeconds(0);
      vibrate(20);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= BROADCAST_MAX_SECONDS) {
            stop();
            return BROADCAST_MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone no work. Check permission.");
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setSeconds(0);
  }

  async function send() {
    if (!blob || busy) return;
    setBusy(true);
    setError("");
    try {
      const ext = extFromType(blob.type);
      const fd = new FormData();
      fd.set(
        "audio",
        new File([blob], `broadcast.${ext}`, {
          type: blob.type || "audio/webm"
        })
      );
      if (title.trim()) fd.set("title", title.trim());
      fd.set("duration_seconds", String(seconds));

      const res = await fetch(`/api/communities/${slug}/broadcasts`, {
        method: "POST",
        body: fd
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Broadcast no send");
        return;
      }
      vibrate(30);
      onSent();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[90] rounded-t-3xl border-t border-border bg-surface px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

        <div className="flex items-center gap-2">
          <span className="text-[1.5rem]">📢</span>
          <div>
            <h2 className="font-serif text-[1.25rem] font-semibold text-ink">
              Send a broadcast
            </h2>
            <p className="text-[0.75rem] text-muted">
              Every member of this space hears it and gets a notification.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[0.65rem] text-faint">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value.slice(0, BROADCAST_TITLE_MAX))
            }
            placeholder="e.g. Estate meeting Sunday 4pm"
            maxLength={BROADCAST_TITLE_MAX}
          />
          <p className="mt-1 text-right text-[0.65rem] text-faint">
            {title.length}/{BROADCAST_TITLE_MAX}
          </p>
        </div>

        <div className="mt-5">
          {!blob && !recording ? (
            <button
              type="button"
              onClick={start}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand py-4 font-serif text-[1.05rem] font-semibold text-white transition-colors hover:bg-brand-soft"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              Start recording
            </button>
          ) : null}

          {recording ? (
            <div className="flex items-center gap-3 rounded-2xl border border-danger bg-danger-soft px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-danger text-white">
                ●
              </span>
              <span className="flex-1 text-[1.05rem] font-medium text-danger">
                {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                {String(seconds % 60).padStart(2, "0")}
                <span className="ml-2 text-[0.75rem] font-normal text-muted">
                  / {BROADCAST_MAX_SECONDS}s max
                </span>
              </span>
              <button
                type="button"
                onClick={stop}
                className="rounded-full bg-ink px-4 py-2 text-[0.75rem] font-semibold text-white"
              >
                Stop
              </button>
            </div>
          ) : null}

          {blob && previewUrl ? (
            <div className="rounded-2xl border border-border bg-paper p-3">
              <div className="flex items-center gap-3">
                <span className="text-[1.4rem]">🎙️</span>
                <audio
                  src={previewUrl}
                  controls
                  className="h-9 flex-1"
                  preload="metadata"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[0.7rem] text-faint">
                  {seconds}s recording
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="text-[0.7rem] font-medium text-danger hover:underline"
                >
                  Re-record
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border-strong bg-paper py-3 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!blob || busy}
            className="flex-1 rounded-xl bg-brand py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-brand-soft disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send to everyone"}
          </button>
        </div>
      </div>
    </>
  );
}