// lib/video-container.ts
//
// Pure helper: map an uploaded video MIME type to the container ffmpeg must
// use when stripping metadata with `-c copy`.
//
// Why: same reason as lib/audio-container.ts. `-c copy` cannot put a
// QuickTime (MOV) video stream into an MP4 container. iPhone recorders
// emit video/quicktime with a .mov extension; forcing "mp4" into ffmpeg
// produces "Could not find tag for codec" and the whole upload 500s.
// This helper matches the container to the real input format.

export type VideoContainer = {
  ext: "mp4" | "mov" | "webm";
  contentType: string;
};

export function videoContainerFor(
  mime: string | null | undefined
): VideoContainer {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("quicktime") || m.includes("mov")) {
    return { ext: "mov", contentType: "video/quicktime" };
  }
  if (m.includes("webm")) {
    return { ext: "webm", contentType: "video/webm" };
  }
  return { ext: "mp4", contentType: "video/mp4" };
}