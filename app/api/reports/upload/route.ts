export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "@/lib/terms-guard";
import { serverError } from "@/lib/http";

// Fix 1: Vercel caps request bodies at 4.5MB. Reports accept up to 25MB of
// evidence (image, video, audio) and up to 10MB of voice testimony. This
// endpoint issues a signed upload URL that the client uses to post the
// file directly to Supabase Storage. The client then POSTs the resulting
// path to /api/reports, which downloads it, strips metadata, moves it to
// the permanent evidence bucket, and deletes the staging object.
//
// The staging bucket is private. Files are not readable during the
// strip-and-verify window, which is what protects us if a report is
// held for moderation.

const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const MAX_VOICE_BYTES = 10 * 1024 * 1024;

const EVIDENCE_MIMES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg", "audio/wav"
]);

const VOICE_MIMES = new Set([
  "audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg", "audio/wav"
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav"
};

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    if (await isBanned(sessionId)) {
      return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
    }

    if (!(await hasAcceptedTerms(sessionId))) {
      return Response.json(
        { error: TERMS_NOT_ACCEPTED_MESSAGE, code: TERMS_NOT_ACCEPTED_CODE },
        { status: 403 }
      );
    }

    // Same overall budget as report_create (20/hour). A user who hits
    // the create limit should hit this too, so routing through here
    // first does not weaken the existing gate.
    const limit = await checkRateLimit(
      sessionId,
      { key: "report_upload", limit: 20, windowMs: 60 * 60 * 1000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json(
        { error: "Slow down — too many uploads. Try again later." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      kind?: unknown;
      mime?: unknown;
      size?: unknown;
    };

    const kind = body.kind;
    if (kind !== "evidence" && kind !== "voice_testimony") {
      return Response.json(
        { error: "kind must be 'evidence' or 'voice_testimony'." },
        { status: 400 }
      );
    }

    const mime = typeof body.mime === "string" ? body.mime.toLowerCase() : "";
    const size = typeof body.size === "number" ? body.size : 0;

    if (!mime || size <= 0) {
      return Response.json(
        { error: "mime and size are required." },
        { status: 400 }
      );
    }

    const allowed = kind === "voice_testimony" ? VOICE_MIMES : EVIDENCE_MIMES;
    if (!allowed.has(mime)) {
      return Response.json(
        { error: "That file type is not accepted." },
        { status: 400 }
      );
    }

    const max = kind === "voice_testimony" ? MAX_VOICE_BYTES : MAX_EVIDENCE_BYTES;
    if (size > max) {
      return Response.json(
        { error: `File too large (max ${Math.floor(max / (1024 * 1024))}MB).` },
        { status: 400 }
      );
    }

    const ext = EXT_BY_MIME[mime] ?? "bin";
    // Path shape: {sessionId}/{kind}/{nanoid}.{ext}. Including the
    // sessionId as the first segment lets us validate the prefix in
    // /api/reports before trusting the path, and makes abandoned
    // uploads cleanable by prefix if we ever add a sweep job.
    const path = `${sessionId}/${kind}/${nanoid()}.${ext}`;

    const db = createServiceClient();
    const { data, error } = await db.storage
      .from("evidence-staging")
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("[reports/upload] createSignedUploadUrl failed:", error);
      return Response.json(
        { error: "Could not start upload." },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      path,
      token: data.token,
      kind,
      mime,
      size
    });
  } catch (e) {
    return serverError("reports/upload", e);
  }
}