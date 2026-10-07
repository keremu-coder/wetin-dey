"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { unlockAudio, vibrate } from "@/lib/sounds";

export function SpaceAvatarUploader({
  slug,
  currentAvatarUrl
}: {
  slug: string;
  currentAvatarUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pick() {
    setError("");
    unlockAudio();
    fileRef.current?.click();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image too large — max 2MB");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("avatar", file);

      const res = await fetch(`/api/communities/${slug}/avatar`, {
        method: "POST",
        body: fd
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Upload failed");
        return;
      }
      setPreview(json.avatar_url ?? null);
      vibrate(25);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/communities/${slug}/avatar`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not remove");
        return;
      }
      setPreview(null);
      vibrate(20);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-ink/5">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Space avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[1.5rem]">🖼️</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-semibold text-ink">
          Space avatar
        </p>
        <p className="text-[0.7rem] text-muted">
          A picture your members see everywhere.
        </p>
        {error ? (
          <p className="mt-1 text-[0.7rem] text-danger">{error}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-1.5 text-[0.7rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {busy ? "…" : preview ? "Replace" : "Upload"}
        </button>
        {preview ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-border-strong bg-paper px-3 py-1.5 text-[0.7rem] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}