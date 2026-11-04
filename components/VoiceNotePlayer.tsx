"use client";

import { useEffect, useRef, useState } from "react";
import { FlagSheet, type FlagTargetType } from "./FlagSheet";

export function VoiceNotePlayer({
  src,
  reportTargetType,
  reportTargetId,
  reportTargetLabel
}: {
  src: string;
  reportTargetType?: FlagTargetType;
  reportTargetId?: string;
  reportTargetLabel?: string;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flagOpen, setFlagOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [src]);

  const canReport =
    !!reportTargetType && !!reportTargetId && !!reportTargetLabel;

  if (error) {
    return (
      <div className="my-1.5 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger-soft px-3 py-2">
        <span className="text-[1.1rem]">⚠️</span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-medium text-danger">
            Voice note no play
          </p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.7rem] text-danger underline"
          >
            Open in new tab
          </a>
        </div>
        {canReport ? (
          <button
            type="button"
            onClick={() => setFlagOpen(true)}
            className="shrink-0 rounded-lg px-2 py-1 text-[0.7rem] text-faint transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Report voice note"
          >
            Report
          </button>
        ) : null}
        {flagOpen && reportTargetType && reportTargetId && reportTargetLabel ? (
          <FlagSheet
            targetType={reportTargetType}
            targetId={reportTargetId}
            targetLabel={reportTargetLabel}
            onClose={() => setFlagOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="my-1.5 flex items-center gap-2 rounded-2xl border border-border bg-paper px-3 py-2">
        <span className="text-[1.1rem]">{loading ? "⏳" : "🎤"}</span>
        <audio
          ref={audioRef}
          src={src}
          controls
          preload="metadata"
          className="h-8 max-w-[240px] flex-1"
          onCanPlay={() => setLoading(false)}
          onError={() => setError(true)}
        />
        {canReport ? (
          <button
            type="button"
            onClick={() => setFlagOpen(true)}
            className="shrink-0 rounded-lg px-2 py-1 text-[0.7rem] text-faint transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Report voice note"
          >
            Report
          </button>
        ) : null}
      </div>

      {flagOpen && reportTargetType && reportTargetId && reportTargetLabel ? (
        <FlagSheet
          targetType={reportTargetType}
          targetId={reportTargetId}
          targetLabel={reportTargetLabel}
          onClose={() => setFlagOpen(false)}
        />
      ) : null}
    </>
  );
}