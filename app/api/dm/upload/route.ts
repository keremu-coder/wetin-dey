export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
    const sid = await getSessionId();
    if (!sid) return NextResponse.json({ error: "no session" }, { status: 401 });

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

    // Check type and size
    const isPhoto = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isPhoto && !isVideo) {
      return NextResponse.json({ error: "Only photos and videos are allowed." }, { status: 400 });
    }

    if (isPhoto && file.size > MAX_PHOTO_SIZE) {
      return NextResponse.json({ error: "Photo is too large (max 5MB)." }, { status: 400 });
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: "Video is too large (max 15MB)." }, { status: 400 });
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || (isPhoto ? "jpg" : "mp4");
    const fileName = `${threadId}/${nanoid()}.${ext}`;
    
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
      type: isPhoto ? "photo" : "video",
      mime: file.type,
      size: file.size
    });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
