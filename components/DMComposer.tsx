"use client";

import { useEffect, useRef, useState } from "react";
import { DM_BODY_MAX } from "@/lib/dm";
import { getBrowserClient } from "@/lib/supabase/client";
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

async function stripPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.9));
}

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
  media_path?: string | null;
  media_type?: string | null;
  viewed_at?: string | null;
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
  const [uploading, setUploading] = useState(false);
  const prefsRef = useRef<SoundPrefs>(DEFAULT_PREFS);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!text || uploading) return;

    unlockAudio();
    const p = prefsRef.current;
    if (p.send) playProfile(p.profile, "send");
    if (p.vibrate) vibrate(20);

    setError("");
    setBody("");

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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    unlockAudio();
    const p = prefsRef.current;
    if (p.send) playProfile(p.profile, "send");
    if (p.vibrate) vibrate(20);

    const cid = onStart(file.type.startsWith("image/") ? "📷 Photo" : "🎥 Video");

    try {
      // Strip EXIF metadata from photos before upload (audit #7)
      const uploadBlob = await stripPhoto(file);

      // 1. Request signed upload URL from server (bypasses Vercel 4.5MB limit)
      const initRes = await fetch("/api/dm/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId, mime: uploadBlob.type, size: uploadBlob.size })
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error || "Could not start upload");

      // 2. Upload file directly from device to Supabase Storage
      const supabase = getBrowserClient();
      const { error: uploadErr } = await supabase.storage
        .from("dm-media")
        .uploadToSignedUrl(initJson.path, initJson.token, uploadBlob);
      if (uploadErr) throw new Error(uploadErr.message || "Upload failed");

      // 3. Create the message record on the server
      const msgRes = await fetch(`/api/dm/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: "",
          media_path: initJson.path,
          media_type: initJson.type,
          media_mime: initJson.mime,
          media_size: initJson.size
        })
      });
      const msgJson = await msgRes.json();
      if (!msgRes.ok) throw new Error(msgJson.error || "Failed to send");

      onSuccess(cid, msgJson.message as SentMessage);
    } catch (err: any) {
      setError(err.message);
      onFail(cid);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <form
      onSubmit={send}
      className="text-[16px] border-t border-border bg-paper/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl"
    >
      {error ? (
        <p className="text-[16px] mb-1 text-[0.75rem] text-danger">{error}</p>
      ) : null}
      <div className="text-[16px] flex items-end gap-2 rounded-2xl border border-border-strong bg-surface px-3 py-2">
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center text-faint transition-colors hover:text-ink disabled:opacity-50"
          aria-label="Attach photo or video"
        >
          {uploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-faint border-t-transparent" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>
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
          className="text-[16px] !max-h-24 !min-h-[28px] flex-1 resize-none !border-0 !bg-transparent !py-1 !text-[0.9375rem] !outline-none !ring-0 focus:!border-0 focus:!ring-0 focus:!shadow-none"
          style={{ boxShadow: "none" }}
        />
        <button
          type="submit"
          disabled={!body.trim() || uploading}
          className="text-[16px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform hover:bg-brand-soft active:scale-90 disabled:opacity-30"
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </form>
  );
}


