"use client";

import { useEffect, useRef, useState } from "react";

export function VoiceNotePlayer({ src }: { src: string }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [src]);

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
      </div>
    );
  }

  return (
    <div className="my-1.5 flex items-center gap-2 rounded-2xl border border-border bg-paper px-3 py-2">
      <span className="text-[1.1rem]">
        {loading ? "⏳" : "🎤"}
      </span>
      <audio
        ref={audioRef}
        src={src}
        controls
        preload="metadata"
        className="h-8 max-w-[240px] flex-1"
        onCanPlay={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </div>
  );
}