export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 15 * 1024 * 1024; // 15MB

// Strict whitelist of allowed MIME types mapped to their canonical extensions
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

    // Rate limiting for media uploads
    const limit = await checkRateLimit(sid, {
      key: "dm_media_upload",
      limit: 15,
      windowMs: 60 * 60 * 1000 // 15 uploads per hour
    }, { ip: getRequestIp(req) });

    if (!limit.ok) {
      return NextResponse.json({ error: "Too many uploads. Wait small." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const threadId = formData.get("threadId") as string | null;

    if (!file || !threadId) {
      return NextResponse.json({ error: "File and threadId required" }, { status: 400 });
    }

    const db = createServiceClient();
    
    // Verify user is in thread
    const { data: thread } = await db
      .from("dm_threads")
      .select("session_a, session_b")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread || (thread.session_a !== sid && thread.session_b !== sid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate type against whitelist
    const fileTypeInfo = ALLOWED_TYPES[file.type];
    if (!fileTypeInfo) {
      return NextResponse.json({ error: "Invalid file type. Only standard photos and videos are allowed." }, { status: 400 });
    }

    // Enforce size limits based on canonical type
    if (fileTypeInfo.type === "photo" && file.size > MAX_PHOTO_SIZE) {
      return NextResponse.json({ error: "Photo is too large (max 5MB)." }, { status: 400 });
    }
    if (fileTypeInfo.type === "video" && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: "Video is too large (max 15MB)." }, { status: 400 });
    }

    // Use a generated filename with the trusted canonical extension
    const fileName = `${threadId}/${nanoid()}.${fileTypeInfo.ext}`;
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await db.storage
      .from("dm-media")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      path: fileName,
      type: fileTypeInfo.type,
      mime: file.type,
      size: file.size
    });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
