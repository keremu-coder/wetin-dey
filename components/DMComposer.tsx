"use client";

import { useEffect, useRef, useState } from "react";
import { DM_BODY_MAX } from "@/lib/dm";
import {
  unlockAudio,
  vibrate,
  playProfile
} from "@/lib/sounds";
import {
  loadPrefs,
  subscribePrefs,
  type SoundPrefs
} from "@/lib/sound-prefs";

const DEFAULT_PREFS: SoundPrefs = {
  profile: "bbm",
  send: true,
  receive: true,
  mention: true,
  notification: true,
  vibrate: true,
  browserNotifications: true
};

type SentMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  held: boolean;
  filter_level: string;
  read_at: string | null;
};

export function DMComposer({
  threadId,
  onStart,
  onSuccess,
  onFail,
  onBlocked
}: {
  threadId: string;
  onStart: (text: string) => string;
  onSuccess: (cid: string, message: SentMessage) => void;
  onFail: (cid: string) => void;
  onBlocked: (reason: string, cid: string) => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const prefsRef = useRef<SoundPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    const initial = loadPrefs();
    prefsRef.current = initial;
    const unsub = subscribePrefs((p) => {
      prefsRef.current = p;
    });
    return unsub;
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    unlockAudio();

    // Sound + haptic fire BEFORE the network call so they feel instant.
    const p = prefsRef.current;
    if (p.send) playProfile(p.profile, "send");
    if (p.vibrate) vibrate(20);

    setError("");
    setBody("");

    // Optimistic message — appears in the thread immediately.
    const cid = onStart(text);

    try {
      const res = await fetch(`/api/dm/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text })
      });
      const json = await res.json();

      if (!res.ok) {
        if (json?.blocked) {
          onBlocked(json.reason ?? "That message contains contact info.", cid);
        } else {
          onFail(cid);
          setError(json?.error ?? "Could not send");
        }
        return;
      }

      onSuccess(cid, json.message as SentMessage);
    } catch {
      onFail(cid);
      setError("Network error");
    }
  }

  return (
    <form
      onSubmit={send}
      className="border-t border-border bg-paper/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl"
    >
      {error ? (
        <p className="mb-1 text-[0.75rem] text-danger">{error}</p>
      ) : null}
      <div className="flex items-end gap-2 rounded-2xl border border-border-strong bg-surface px-3 py-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, DM_BODY_MAX))}
          placeholder="Message"
          rows={1}
          maxLength={DM_BODY_MAX}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e as unknown as React.FormEvent);
            }
          }}
          className="!max-h-24 !min-h-[28px] flex-1 resize-none !border-0 !bg-transparent !py-1 !text-[0.9375rem] !outline-none !ring-0 focus:!border-0 focus:!ring-0 focus:!shadow-none"
          style={{ boxShadow: "none" }}
        />
        <button
          type="submit"
          disabled={!body.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-90 disabled:opacity-30"
          aria-label="Send"
        >
          <svg
            width="16"
            height="16"
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
    </form>
  );
}