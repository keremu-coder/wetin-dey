"use client";

import { useEffect, useState } from "react";
import { Alama } from "./Alama";
import { normalizeMediaUrl } from "@/lib/media-url";

type AvatarProps = {
  src?: string | null;
  seed: string;
  size?: number;
  title?: string;
  className?: string;
  border?: boolean;
};

export function Avatar({ src, seed, size = 48, title = "", className = "", border = false }: AvatarProps) {
  const borderClass = border ? "border border-border" : "";
  const resolved = normalizeMediaUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper ${borderClass} ${className}`}
      style={{ width: size, height: size }}
    >
      {resolved && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={title}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Alama seed={seed} size={size} title={title} />
      )}
    </div>
  );
}