"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";

/**
 * Avatar that opens a full-screen viewer on tap.
 *
 * Falls back to the plain Avatar (no click target) when there is no photo
 * the viewer is allowed to see — clicking the Alama mark should not do
 * anything.
 *
 * `border` defaults to true to preserve the report-card look. Pass
 * `border={false}` on surfaces that never had a border (profile header).
 */
export function ZoomableAvatar({
  src,
  seed,
  size,
  title,
  className = "",
  border = true
}: {
  src: string | null | undefined;
  seed: string;
  size: number;
  title: string;
  className?: string;
  border?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <Avatar
        src={null}
        seed={seed}
        size={size}
        title={title}
        className={className}
        border={border}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand active:scale-95 transition-transform ${className}`}
        aria-label="View full size photo"
      >
        <Avatar src={src} seed={seed} size={size} title={title} border={border} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 p-2 text-white/70 hover:text-white"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}