"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { StatusViewer } from "./StatusViewer";

export type StatusPhoto = {
  id: string;
  handle: string;
  status_line: string | null;
  status_photo_url: string;
  status_photo_updated_at: string;
};

export function StatusBar({
  statuses,
  myStatus,
  myHandle
}: {
  statuses: StatusPhoto[];
  myStatus: StatusPhoto | null;
  myHandle: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<StatusPhoto | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
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
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Upload failed");
      }
      toast.show("Status updated!", "success");
      router.refresh();
    } catch (err) {
      toast.show(
        err instanceof Error && err.message ? err.message : "Could not upload photo",
        "error"
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch("/api/settings/status-photo", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.show("Status removed", "success");
      setViewing(null);
      router.refresh();
    } catch {
      toast.show("Could not remove status", "error");
    }
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto border-b border-border px-5 py-3 scrollbar-hide">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="relative h-16 w-16">
            <button
              type="button"
              onClick={() =>
                myStatus ? setViewing(myStatus) : fileInput.current?.click()
              }
              disabled={uploading}
              aria-label={
                myStatus
                  ? `View your status, ${myHandle}`
                  : "Add a status photo"
              }
              className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ${
                myStatus
                  ? "border-2 border-brand p-[2px]"
                  : "border-2 border-dashed border-brand/40 bg-brand-tint/20"
              }`}
            >
              {uploading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              ) : myStatus ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={myStatus.status_photo_url}
                  alt="Your current status"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-[1.5rem] text-brand">+</span>
              )}
            </button>
            {myStatus ? (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="Replace your status photo"
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-brand text-[1rem] font-semibold text-white"
              >
                +
              </button>
            ) : null}
          </div>
          <span className="w-16 truncate text-center text-[0.7rem] font-medium text-muted">
            {myStatus ? "My status" : "Add status"}
          </span>
        </div>

        {statuses.map((status) => (
          <button
            type="button"
            key={status.id}
            onClick={() => setViewing(status)}
            aria-label={`View @${status.handle}'s status`}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span className="relative h-16 w-16 rounded-full border-2 border-brand p-[2px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={status.status_photo_url}
                alt=""
                className="h-full w-full rounded-full object-cover bg-brand-tint/30"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
            </span>
            <span className="w-16 truncate text-center text-[0.7rem] font-medium text-ink">
              @{status.handle}
            </span>
          </button>
        ))}

        {statuses.length === 0 ? (
          <div className="flex items-center text-[0.75rem] text-faint">
            No recent status photos. Be the first!
          </div>
        ) : null}

      </div>
      {viewing ? (
        <StatusViewer
          status={{
            id: viewing.id,
            handle: viewing.handle,
            photo_url: viewing.status_photo_url,
            status_line: viewing.status_line,
            created_at: viewing.status_photo_updated_at
          }}
          isMine={viewing.id === myStatus?.id}
          onClose={() => setViewing(null)}
          onDelete={viewing.id === myStatus?.id ? handleDelete : undefined}
          onReplace={
            viewing.id === myStatus?.id
              ? () => {
                  setViewing(null);
                  fileInput.current?.click();
                }
              : undefined
          }
        />
      ) : null}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />
    </>
  );
}