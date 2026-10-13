"use client";

import type { Message } from "@/lib/chat";
import { autocorrect } from "@/lib/autocorrect";

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
  onSubmit
}: ChatComposerProps) {
  return (
    <form
      onSubmit={(e) => {
        const pid = replyTo?.id ?? null;
        onSubmit(e, pid);
      }}
      className="border-t border-border bg-paper/90 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl"
    >
      {error ? (
        <p className="mb-1 text-[0.75rem] text-danger">{error}</p>
      ) : null}

      {replyTo ? (
        <div className="mb-1.5 flex items-start gap-2 rounded-xl border-l-2 border-brand bg-ink/[0.04] px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] font-semibold text-brand">
              Replying to @{replyTo.author_handle}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[0.8125rem] leading-snug text-muted">
              {replyTo.body && replyTo.body.trim()
                ? replyTo.body
                : replyTo.audio_url
                  ? "Voice note"
                  : "(empty)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 rounded-full p-1 text-faint transition-colors hover:bg-ink/10 hover:text-ink"
            aria-label="Cancel reply"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : null}

      {suggestion && composerMode === "text" ? (
        <div className="mb-1.5 flex items-center gap-2 text-[0.75rem]">
          <span className="text-muted">
            Correct{" "}
            <span className="font-medium text-ink line-through">
              {suggestion.original}
            </span>{" "}
            {"\u2192"}{" "}
            <span className="font-semibold text-brand">
              {suggestion.suggested}
            </span>
            ?
          </span>
          <button
            type="button"
            onClick={onApplySuggestion}
            className="rounded-md bg-brand px-2 py-0.5 text-[0.7rem] font-semibold text-white"
          >
            Fix
          </button>
          <button
            type="button"
            onClick={onDismissSuggestion}
            className="text-faint hover:text-ink"
          >
            {"\u2715"}
          </button>
        </div>
      ) : null}

      {recording ? (
        <div className="flex items-center gap-3 rounded-full border border-danger bg-danger-soft px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 animate-pulse items-center justify-center rounded-full bg-danger text-white">
            {"\u25CF"}
          </span>
          <span
            className="flex-1 text-[0.9375rem] font-semibold text-danger"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:
            {String(recordSeconds % 60).padStart(2, "0")}
            <span className="ml-2 text-[0.75rem] font-normal">/ 00:30</span>
          </span>
          <button
            type="button"
            onClick={onCancelVoice}
            className="shrink-0 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-[0.75rem] font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onStopVoice}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-90"
            aria-label="Send voice note"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      ) : composerMode === "voice" ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToText}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-ink transition-colors hover:bg-ink/5"
            aria-label="Switch to text"
            title="Type instead"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="6" width="20" height="12" rx="3" />
              <line x1="6" y1="10" x2="6" y2="14" />
              <line x1="10" y1="10" x2="10" y2="14" />
              <line x1="14" y1="10" x2="14" y2="14" />
              <line x1="18" y1="10" x2="18" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onStartVoice}
            className="flex h-14 flex-1 items-center justify-center gap-3 rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-[0.98]"
            aria-label="Tap to record voice note"
          >
            <svg
              width="24"
              height="24"
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
            <span className="font-serif text-[1rem] font-semibold">
              Tap to talk
            </span>
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={onSwitchToVoice}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-ink transition-colors hover:bg-ink/5"
            aria-label="Switch to voice"
            title="Talk instead"
          >
            <svg
              width="20"
              height="20"
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
          </button>
          <div className="composer-shell flex flex-1 items-end gap-2 rounded-2xl border border-border-strong bg-surface px-3 py-2">
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
              className="!max-h-24 !min-h-[28px] flex-1 resize-none !border-0 !bg-transparent !py-1 !text-[0.9375rem] !outline-none !ring-0 focus:!border-0 focus:!ring-0 focus:!shadow-none"
              style={{ boxShadow: "none" }}
            />
          </div>
          <button
            type="submit"
            disabled={!body.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-90 disabled:opacity-30"
            aria-label="Send"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      )}
    </form>
  );
}