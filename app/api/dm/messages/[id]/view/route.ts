export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const sessionId = await getSessionId();
    if (!sessionId) return NextResponse.json({ error: "no session" }, { status: 401 });

    const db = createServiceClient();

    // 1. Verify the user is part of this thread and the message exists
    const { data: msg } = await db
      .from("dm_messages")
      .select("id, thread_id, media_path, media_type, viewed_at")
      .eq("id", params.id)
      .maybeSingle();

    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (!msg.media_path) return NextResponse.json({ error: "No media attached" }, { status: 400 });
    if (msg.viewed_at) return NextResponse.json({ error: "Already viewed" }, { status: 403 });

    const { data: thread } = await db
      .from("dm_threads")
      .select("session_a, session_b")
      .eq("id", msg.thread_id)
      .maybeSingle();

    if (!thread || (thread.session_a !== sessionId && thread.session_b !== sessionId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Atomic lock: Mark as viewed ONLY if it hasn't been viewed yet
    const { data: updated, error: updateError } = await db
      .from("dm_messages")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", msg.id)
      .is("viewed_at", null)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Already viewed or expired" }, { status: 403 });
    }

    // 3. Generate a short-lived signed URL (valid for 60 seconds)
    const { data: signedUrlData, error: signedError } = await db.storage
      .from("dm-media")
      .createSignedUrl(msg.media_path, 60);

    if (signedError || !signedUrlData) {
      return NextResponse.json({ error: "Failed to generate secure link" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url: signedUrlData.signedUrl,
      type: msg.media_type
    });

  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
