"use client";

// Pick a MediaRecorder-compatible mime type for the current browser.
// iOS Safari only supports audio/mp4 (AAC). Chrome/Android prefer webm/opus.
// Firefox prefers ogg/opus.

export type RecorderFormat = {
  mimeType: string;   // "" means use browser default
  extension: string;  // file extension for the uploaded blob
};

export function pickRecorderFormat(): RecorderFormat {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "", extension: "webm" };
  }

  const candidates: Array<{ mime: string; ext: string }> = [
    // iOS Safari 14.3+
    { mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
    { mime: "audio/mp4", ext: "m4a" },
    // Chrome / Android / Desktop
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    // Firefox fallback
    { mime: "audio/ogg;codecs=opus", ext: "ogg" }
  ];

  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) {
        return { mimeType: c.mime, extension: c.ext };
      }
    } catch {
      /* ignore */
    }
  }

  return { mimeType: "", extension: "webm" };
}

/**
 * After a MediaRecorder finishes, its `mimeType` property reflects what was
 * actually produced (may differ from the requested mimeType on some
 * browsers). Use this to set the correct type on the blob.
 */
export function actualMime(mr: MediaRecorder, fallback: string): string {
  const m = (mr.mimeType || "").trim();
  if (m) return m;
  if (fallback) return fallback;
  return "audio/webm";
}

/**
 * File extension appropriate for a given blob type string.
 */
export function extFromType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("webm")) return "webm";
  if (t.includes("wav")) return "wav";
  return "webm";
}