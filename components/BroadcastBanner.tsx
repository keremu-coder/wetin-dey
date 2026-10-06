"use client";

import { useEffect, useRef, useState } from "react";
import { broadcastAge, broadcastExpiresIn } from "@/lib/broadcasts";

export type Broadcast = {
  id: string;
  session_id: string;
  audio_url: string;
  duration_seconds: number | null;
  title: string | null;
  created_at: string;
  expires_at: string;
  author_handle: string;
};

export function BroadcastBanner({
  broadcasts,
  onDismiss
}: {
  broadcasts: Broadcast[];
  onDismiss?: (id: string) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (current >= broadcasts.length) setCurrent(0);
  }, [broadcasts.length, current]);

  if (broadcasts.length === 0) return null;

  const b = broadcasts[Math.min(current, broadcasts.length - 1)];

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.currentTime = 0;
      void el.play().catch(() => {});
    }
  }

  function cycle() {
    if (broadcasts.length <= 1) return;
    setCurrent((c) => (c + 1) % broadcasts.length);
    setPlaying(false);
  }

  return (
    <div className="border-b border-gold/30 bg-gold-soft/60 px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-[1.3rem] text-ink">
          📢
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ink/70">
              Broadcast · @{b.author_handle}
            </p>
            <span className="shrink-0 font-mono text-[0.65rem] text-ink/60">
              {broadcastAge(b.created_at)}
            </span>
          </div>

          {b.title ? (
            <p className="mt-1 text-[0.9375rem] font-semibold leading-snug text-ink">
              {b.title}
            </p>
          ) : (
            <p className="mt-1 text-[0.8125rem] italic text-ink/70">
              Voice broadcast
            </p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white transition-transform hover:opacity-90 active:scale-95"
              aria-label={playing ? "Pause" : "Play broadcast"}
            >
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="7,5 19,12 7,19" />
                </svg>
              )}
            </button>

            {b.duration_seconds ? (
              <span className="font-mono text-[0.7rem] text-ink/60">
                {Math.floor(b.duration_seconds / 60)}:
                {String(b.duration_seconds % 60).padStart(2, "0")}
              </span>
            ) : null}

            <span className="font-mono text-[0.7rem] text-ink/60">
              · {broadcastExpiresIn(b.expires_at)}
            </span>

            {broadcasts.length > 1 ? (
              <button
                type="button"
                onClick={cycle}
                className="ml-auto rounded-lg border border-ink/20 bg-paper/60 px-2 py-1 font-mono text-[0.65rem] font-medium text-ink transition-colors hover:bg-paper"
              >
                {current + 1}/{broadcasts.length} →
              </button>
            ) : null}
          </div>

          <audio
            ref={audioRef}
            src={b.audio_url}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            preload="none"
          />
        </div>

        {onDismiss ? (
          <button
            type="button"
            onClick={() => onDismiss(b.id)}
            className="shrink-0 text-[0.9rem] text-ink/40 transition-colors hover:text-ink"
            aria-label="Hide for now"
            title="Hide"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}