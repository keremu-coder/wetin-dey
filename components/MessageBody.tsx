"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getFontById } from "@/lib/fonts-registry";
import { getTextColor } from "@/lib/text-colors";

type Segment =
  | { type: "text"; value: string }
  | { type: "mention"; handle: string }
  | { type: "link"; url: string };

function parseMessage(body: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /(@[a-zA-Z0-9_]+)|(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      segments.push({ type: "mention", handle: match[1].slice(1) });
    } else if (match[2]) {
      segments.push({ type: "link", url: match[2] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }

  return segments;
}

export function MessageBody({
  body,
  isOwn,
  mentionsMe,
  fontId,
  colorId
}: {
  body: string;
  isOwn: boolean;
  mentionsMe?: boolean;
  fontId?: string | null;
  colorId?: string | null;
}) {
  const segments = useMemo(() => parseMessage(body), [body]);
  const font = getFontById(fontId);
  const color = getTextColor(colorId);

  const fontSize = font.sizeAdjust
    ? `calc(0.9375rem * ${font.sizeAdjust})`
    : undefined;

  return (
    <p
      className={`whitespace-pre-wrap break-words leading-[1.4] ${
        mentionsMe && !isOwn
          ? "rounded-md bg-accent-soft/60 px-1.5 py-0.5 -mx-1.5 -my-0.5"
          : ""
      }`}
      style={{
        fontFamily: font.family,
        fontSize,
        color: isOwn ? undefined : `var(--tc-${color.id}-light)`
      }}
    >
      {segments.map((seg, i) => {
        if (seg.type === "mention") {
          return (
            <Link
              key={i}
              href={`/u/${encodeURIComponent(seg.handle)}`}
              className={`rounded px-1 py-0.5 font-medium transition-colors ${
                isOwn
                  ? "bg-white/20 text-white hover:bg-white/30"
                  : "bg-accent-soft text-accent-deep hover:bg-accent/20"
              }`}
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            >
              @{seg.handle}
            </Link>
          );
        }

        if (seg.type === "link") {
          return (
            <a
              key={i}
              href={seg.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-all underline transition-colors ${
                isOwn
                  ? "text-white/90 hover:text-white"
                  : "text-accent hover:text-accent-deep"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {seg.url}
            </a>
          );
        }

        return <span key={i}>{seg.value}</span>;
      })}
    </p>
  );
}