// lib/audio-container.ts
//
// Pure helper: map an uploaded audio MIME type to the container ffmpeg must
// use when stripping metadata with `-c copy`.
//
// Why: the stripper copies streams without re-encoding, so the output
// container must be able to hold the input codec. iPhones record AAC in an
// MP4 (m4a) container; forcing that into WebM fails ("Only VP8 or VP9 or
// AV1 video and Vorbis or Opus audio ... are supported for WebM") and the
// upload was rejected. Matching the container to the real format works for
// every format below (tested with ffmpeg: tags removed, exit 0).

export type AudioContainer = {
  /** ffmpeg input/output extension */
  ext: "webm" | "m4a" | "ogg" | "mp3" | "wav";
  /** Content-Type to store the file under */
  contentType: string;
};

export function audioContainerFor(mime: string | null | undefined): AudioContainer {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac") || m.includes("x-m4a")) {
    return { ext: "m4a", contentType: "audio/mp4" };
  }
  if (m.includes("ogg")) return { ext: "ogg", contentType: "audio/ogg" };
  if (m.includes("mpeg") || m.includes("mp3")) {
    return { ext: "mp3", contentType: "audio/mpeg" };
  }
  if (m.includes("wav")) return { ext: "wav", contentType: "audio/wav" };
  return { ext: "webm", contentType: "audio/webm" };
}
