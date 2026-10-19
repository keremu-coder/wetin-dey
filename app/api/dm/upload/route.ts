export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, { ext: string, type: "photo" | "video" }> = {
  "image/jpeg": { ext: "jpg", type: "photo" },
  "image/png": { ext: "png", type: "photo" },
  "image/webp": { ext: "webp", type: "photo" },
  "image/heic": { ext: "heic", type: "photo" },
  "video/mp4": { ext: "mp4", type: "video" },
  "video/quicktime": { ext: "mov", type: "video" },
  "video/webm": { ext: "webm", type: "video" },
};

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

    const limit = await checkRateLimit(sid,
      { key: "dm_media_upload", limit: 15, windowMs: 60 * 60 * 1000 },
      { ip: getRequestIp(req) });
    if (!limit.ok) return NextResponse.json({ error: "Too many uploads. Wait small." }, { status: 429 });

    const body = (await req.json()) as { threadId?: string; mime?: string; size?: number };
    const threadId = body.threadId;
    const mime = body.mime ?? "";
    const size = body.size ?? 0;

    if (!threadId || !mime || !size) {
      return NextResponse.json({ error: "threadId, mime, and size are required." }, { status: 400 });
    }

    const info = ALLOWED_TYPES[mime];
    if (!info) return NextResponse.json({ error: "Invalid file type." }, { status: 400 });

    const max = info.type === "photo" ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
    if (size > max) return NextResponse.json({ error: "File too large." }, { status: 400 });

    const db = createServiceClient();
    const { data: thread } = await db
      .from("dm_threads").select("session_a, session_b").eq("id", threadId).maybeSingle();
    if (!thread || (thread.session_a !== sid && thread.session_b !== sid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const path = `${threadId}/${nanoid()}.${info.ext}`;
    const { data, error } = await db.storage.from("dm-media").createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[dm/upload] createSignedUploadUrl failed:", error);
      return NextResponse.json({ error: "Failed to start upload" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      path,
      token: data.token,
      type: info.type,
      mime,
      size
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
