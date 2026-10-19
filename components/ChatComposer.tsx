"use client";

import { useRef, useState } from "react";
import type { Message } from "@/lib/chat";
import { autocorrect } from "@/lib/autocorrect";
import { playProfile, unlockAudio, vibrate } from "@/lib/sounds";
import { makeCid } from "@/lib/chat";

export type ChatComposerProps = {
  body: string;
  onBodyChange: (v: string) => void;
  error: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  suggestion: { original: string; suggested: string } | null;
  onApplySuggestion: () => void;
  onDismissSuggestion: () => void;
  recording: boolean;
  recordSeconds: number;
  onCancelVoice: () => void;
  onStopVoice: () => void;
  onStartVoice: () => void;
  composerMode: "voice" | "text";
  onSwitchToText: () => void;
  onSwitchToVoice: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  autocorrectOn: boolean;
  onBodyAutocorrected: (v: string) => void;
  onSubmit: (e: React.FormEvent, parentId: string | null) => void;
  slug: string;
  isPublic: boolean;
  onMediaUploaded: (message: Message) => void;
  onMediaStart: (cid: string) => void;
  onMediaFail: (cid: string) => void;
};

export function ChatComposer({
  body,
  onBodyChange,
  error,
  replyTo,
  onCancelReply,
  suggestion,
  onApplySuggestion,
  onDismissSuggestion,
  recording,
  recordSeconds,
  onCancelVoice,
  onStopVoice,
  onStartVoice,
  composerMode,
  onSwitchToText,
  onSwitchToVoice,
  textareaRef,
  autocorrectOn,
  onBodyAutocorrected,
  onSubmit,
  slug,
  isPublic,
  onMediaUploaded,
  onMediaStart,
  onMediaFail
}: ChatComposerProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    unlockAudio();
    playProfile("bbm", "send");
    vibrate(20);

    const cid = makeCid();
    onMediaStart(cid);

    try {
      const formData = new FormData();
      formData.append("media", file);
      if (replyTo?.id) formData.append("parent_id", replyTo.id);

      const res = await fetch(`/api/communities/${slug}/messages`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();

      if (!res.ok || !json?.message) {
        throw new Error(json?.error || "Upload failed");
      }

      onMediaUploaded(json.message);
    } catch (err: any) {
      onMediaFail(cid);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <form
      onSubmit={(e) => {
        const pid = replyTo?.id ?? null;
        onSubmit(e, pid);
      }}
      className="text-[16px] border-t border-border bg-paper/90 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl shrink-0"
    >
      {error ? (
        <p className="text-[16px] mb-1 text-[0.75rem] text-danger">{error}</p>
      ) : null}

      {replyTo ? (
        <div className="text-[16px] mb-1.5 flex items-start gap-2 rounded-xl border-l-2 border-brand bg-ink/[0.04] px-2.5 py-1.5">
          <div className="text-[16px] min-w-0 flex-1">
            <p className="text-[16px] truncate text-[0.75rem] font-semibold text-brand">
              Replying to @{replyTo.author_handle}
            </p>
            <p className="text-[16px] mt-0.5 line-clamp-1 text-[0.8125rem] leading-snug text-muted">
              {replyTo.body && replyTo.body.trim()
                ? replyTo.body
                : replyTo.audio_url
                  ? "Voice note"
                  : replyTo.media_path
                    ? "📷 Media"
                    : "(empty)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-[16px] shrink-0 rounded-full p-1 text-faint transition-colors hover:bg-ink/10 hover:text-ink"
            aria-label="Cancel reply"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : null}

      {suggestion && composerMode === "text" ? (
        <div className="text-[16px] mb-1.5 flex items-center gap-2 text-[0.75rem]">
          <span className="text-[16px] text-muted">
            Correct{" "}
            <span className="text-[16px] font-medium text-ink line-through">
              {suggestion.original}
            </span>{" "}
            {"\u2192"}{" "}
            <span className="text-[16px] font-semibold text-brand">
              {suggestion.suggested}
            </span>
            ?
          </span>
          <button type="button" onClick={onApplySuggestion} className="text-[16px] rounded-md bg-brand px-2 py-0.5 text-[0.7rem] font-semibold text-white">Fix</button>
          <button type="button" onClick={onDismissSuggestion} className="text-[16px] text-faint hover:text-ink">{"\u2715"}</button>
        </div>
      ) : null}

      {recording ? (
        <div className="text-[16px] flex items-center gap-3 rounded-full border border-danger bg-danger-soft px-3 py-2">
          <span className="text-[16px] flex h-8 w-8 shrink-0 animate-pulse items-center justify-center rounded-full bg-danger text-white">
            {"\u25CF"}
          </span>
          <span className="text-[16px] flex-1 text-[0.9375rem] font-semibold text-danger" style={{ fontVariantNumeric: "tabular-nums" }}>
            {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:
            {String(recordSeconds % 60).padStart(2, "0")}
            <span className="text-[16px] ml-2 text-[0.75rem] font-normal">/ 00:30</span>
          </span>
          <button type="button" onClick={onCancelVoice} className="text-[16px] shrink-0 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-[0.75rem] font-medium text-ink transition-colors hover:bg-ink/5">Cancel</button>
          <button type="button" onClick={onStopVoice} className="text-[16px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-90" aria-label="Send voice note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      ) : composerMode === "voice" ? (
        <div className="text-[16px] flex items-center gap-3">
          <button type="button" onClick={onSwitchToText} className="text-[16px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-ink transition-colors hover:bg-ink/5" aria-label="Switch to text" title="Type instead">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="3" />
              <line x1="6" y1="10" x2="6" y2="14" />
              <line x1="10" y1="10" x2="10" y2="14" />
              <line x1="14" y1="10" x2="14" y2="14" />
              <line x1="18" y1="10" x2="18" y2="14" />
            </svg>
          </button>
          <button type="button" onClick={onStartVoice} className="text-[16px] flex h-14 flex-1 items-center justify-center gap-3 rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-[0.98]" aria-label="Tap to record voice note">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <span className="text-[16px] font-serif text-[1rem] font-semibold">Tap to talk</span>
          </button>
        </div>
      ) : (
        <div className="text-[16px] flex items-end gap-2">
          <button type="button" onClick={onSwitchToVoice} className="text-[16px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-ink transition-colors hover:bg-ink/5" aria-label="Switch to voice" title="Talk instead">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
          
          <div className="text-[16px] composer-shell flex flex-1 items-center gap-2 rounded-2xl border border-border-strong bg-surface px-3 py-2">
            {!isPublic && (
              <>
                <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFile} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="shrink-0 text-faint hover:text-ink" aria-label="Attach photo or video">
                  {uploading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-faint border-t-transparent" />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  )}
                </button>
              </>
            )}
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              onBlur={() => {
                if (autocorrectOn && body.trim()) {
                  onBodyAutocorrected(autocorrect(body));
                }
              }}
              placeholder="Message"
              rows={1}
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const pid = replyTo?.id ?? null;
                  onSubmit(e as unknown as React.FormEvent, pid);
                }
              }}
              className="text-[16px] !max-h-24 !min-h-[28px] flex-1 resize-none !border-0 !bg-transparent !py-1 !text-[0.9375rem] !outline-none !ring-0 focus:!border-0 focus:!ring-0 focus:!shadow-none"
              style={{ boxShadow: "none" }}
            />
          </div>
          <button type="submit" disabled={!body.trim() || uploading} className="text-[16px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-90 disabled:opacity-30" aria-label="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      )}
    </form>
  );
}
