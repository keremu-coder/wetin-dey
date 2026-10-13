export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";

const STAGING_BUCKET = "report-staging";
const MAX_BYTES = 25 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav"
};

/**
 * Signed upload URL for the report staging bucket. The client PUTs the
 * file directly to Supabase Storage, avoiding Vercel's ~4.5 MB request
 * body limit. The client then POSTs the returned `path` to /api/reports
 * along with the other form fields. The server downloads the object,
 * strips metadata, and promotes it to the public evidence bucket.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }
    const sid = await getSessionId();
    if (!sid) {
      return Response.json({ error: "no session" }, { status: 401 });
    }
    const denied = await assertCanWrite(sid);
    if (denied) return denied;

    const rl = await checkRateLimit(
      sid,
      { key: "report_upload_url", limit: 20, windowMs: 60 * 60 * 1000 },
      { ip: getRequestIp(req) }
    );
    if (!rl.ok) {
      return Response.json(
        { error: "Too many uploads. Wait small." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { mime?: unknown; size?: unknown };
    const mime = typeof body?.mime === "string" ? body.mime : "";
    const size = typeof body?.size === "number" ? body.size : 0;

    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      return Response.json(
        { error: "File must be image, video, or audio." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
      return Response.json(
        { error: "File too large (max 25MB)" },
        { status: 400 }
      );
    }

    const path = `${sid}/${nanoid()}.${ext}`;

    const db = createServiceClient();
    const { data, error } = await db.storage
      .from(STAGING_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.token || !data?.path) {
      console.error("[reports/upload-url] signed url failed:", error?.message);
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({
      path: data.path,
      signedUrl: data.signedUrl,
      bucket: STAGING_BUCKET
    });
  } catch (e) {
    console.error("[reports/upload-url]", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}