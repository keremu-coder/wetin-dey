/**
 * Voice note moderation via Whisper transcription + existing text filter.
 *
 * Flow:
 *   1. POST the audio buffer to Groq Whisper → text transcript
 *   2. Run analyzeModeration() on the transcript (threats, hate, profanity)
 *   3. Return the same shape as analyzeModeration so callers treat voice
 *      and text uniformly.
 *
 * Best-effort by design: any error (no key, network, oversized file,
 * timeout, non-audio) fails open — the voice note is allowed and the
 * report/comment is created normally. Blocking a legitimate voice
 * testimony because Whisper is unreachable would be worse than letting
 * one slip through.
 *
 * The transcript is also returned so callers can store it as a preview,
 * matching the `transcript` column that already exists on comments.
 */

import {
  analyzeModeration,
  type ModerationResult
} from "@/lib/dm-filter";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const TIMEOUT_MS = 15000;

export type VoiceModerationOutcome = ModerationResult & {
  transcript: string | null;
  transcribed: boolean;
};

const EMPTY: VoiceModerationOutcome = {
  hold: false,
  matches: [],
  reasons: [],
  transcript: null,
  transcribed: false
};

export async function transcribeAndModerate(
  buffer: Buffer,
  mimeType: string
): Promise<VoiceModerationOutcome> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[voice-mod] GROQ_API_KEY not set — skipping");
    return EMPTY;
  }

  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    console.warn(
      `[voice-mod] skip: size ${buffer.length} outside 0..${MAX_BYTES}`
    );
    return EMPTY;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const form = new FormData();
    // Buffer is Uint8Array<ArrayBufferLike>, which TS won't accept as a
    // BlobPart (SharedArrayBuffer is in the union). Copy into a fresh
    // Uint8Array backed by a real ArrayBuffer.
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    form.append(
      "file",
      new Blob([bytes], { type: mimeType || "audio/webm" }),
      "voice.webm"
    );
    form.append("model", MODEL);
    form.append("response_format", "json");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal
    });

    if (!res.ok) {
      console.warn(`[voice-mod] groq HTTP ${res.status}`);
      return EMPTY;
    }

    const json = (await res.json()) as { text?: string };
    const transcript = typeof json.text === "string" ? json.text.trim() : "";

    if (!transcript) {
      return { ...EMPTY, transcribed: true };
    }

    const moderation = analyzeModeration(transcript);
    return {
      ...moderation,
      transcript,
      transcribed: true
    };
  } catch (e) {
    console.warn(
      "[voice-mod] error:",
      e instanceof Error ? e.message : String(e)
    );
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}