"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

type Status = {
  id: string;
  handle: string;
  status_line: string | null;
  status_photo_url: string;
  status_photo_updated_at: string;
};

export function StatusBar({
  statuses,
  myHandle
}: {
  statuses: Status[];
  myHandle: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.show("Photo too large (max 5MB)", "error");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("photo", file);

    try {
      const res = await fetch("/api/settings/status-photo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.show("Status updated!", "success");
      router.refresh();
    } catch {
      toast.show("Could not upload photo", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto px-5 py-3 scrollbar-hide border-b border-border">
      {/* My Status (Upload Button) */}
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-brand/40 bg-brand-tint/20 transition-colors hover:bg-brand-tint/40">
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          ) : (
            <span className="text-[1.5rem] text-brand">+</span>
          )}
        </label>
        <span className="w-16 truncate text-center text-[0.7rem] font-medium text-muted">
          My Status
        </span>
      </div>

      {/* Friends' Statuses */}
      {statuses.map((s) => (
        <Link
          key={s.id}
          href={`/u/${encodeURIComponent(s.handle)}`}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative h-16 w-16 rounded-full border-2 border-brand p-[2px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.status_photo_url}
              alt={`@${s.handle}`}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <span className="w-16 truncate text-center text-[0.7rem] font-medium text-ink">
            @{s.handle}
          </span>
        </Link>
      ))}

      {statuses.length === 0 && (
        <div className="flex items-center text-[0.75rem] text-faint">
          No friends have a status today. Be the first!
        </div>
      )}
    </div>
  );
}
