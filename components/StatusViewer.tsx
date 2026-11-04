"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileActions } from "./ProfileActions";

export function StatusViewer({
  status,
  isMine = false,
  onClose,
  onDelete,
  onReplace
}: {
  status: { id: string; handle: string; photo_url: string; status_line: string | null; created_at: string } | null;
  isMine?: boolean;
  onClose: () => void;
  onDelete?: () => void | Promise<void>;
  onReplace?: () => void;
}) {
  const [imgState, setImgState] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Reset when a different story is opened.
  useEffect(() => {
    setImgState("loading");
    setAttempt(0);
  }, [status?.photo_url]);

  // Lock page scroll behind the full-screen viewer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!status) return null;

  return (
    <div 
      className="fixed inset-0 z-[999] flex flex-col bg-black" 
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 text-white">
        <div className="flex items-center gap-3">
          <Link
            href={`/u/${encodeURIComponent(status.handle)}`}
            onClick={onClose}
            className="flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center font-bold text-white">
              {status.handle.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-[0.9375rem]">@{status.handle}</p>
              <p className="text-[0.7rem] text-white/70">
                {new Date(status.created_at).toLocaleString()}
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {!isMine ? (
            <ProfileActions
              profileId={status.id}
              handle={status.handle}
            />
          ) : null}
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white" aria-label="Close status">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="relative flex flex-1 items-center justify-center p-4" onClick={onClose}>
        {imgState === "loading" ? (
          <span className="absolute h-8 w-8 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
        ) : null}
        {imgState === "error" ? (
          <div className="text-center text-white" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-[0.95rem]">Couldn&apos;t load this status.</p>
            <button
              type="button"
              onClick={() => {
                setImgState("loading");
                setAttempt((n) => n + 1);
              }}
              className="rounded-xl bg-white/15 px-4 py-2 text-[0.85rem] font-semibold"
            >
              Try again
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={attempt}
            src={attempt > 0 ? `${status.photo_url}?r=${attempt}` : status.photo_url}
            alt={`Status from @${status.handle}`}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setImgState("ok")}
            onError={() => setImgState("error")}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}
      </div>

      {isMine && (onReplace || onDelete) ? (
        <div className="flex justify-center gap-3 px-6 py-4">
          {onReplace ? (
            <button
              type="button"
              onClick={onReplace}
              className="rounded-xl bg-white/15 px-4 py-2 text-[0.85rem] font-semibold text-white"
            >
              Replace
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!confirm("Delete your status photo?")) return;
                setDeleting(true);
                try {
                  await onDelete();
                } finally {
                  setDeleting(false);
                }
              }}
              className="rounded-xl bg-red-600/90 px-4 py-2 text-[0.85rem] font-semibold text-white disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Caption */}
      {status.status_line && (
        <div className="px-6 pb-8 pt-4 text-center">
          <p className="text-white text-[1rem] font-medium">{status.status_line}</p>
        </div>
      )}
    </div>
  );
}