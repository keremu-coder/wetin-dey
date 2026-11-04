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

    // 1. Verify message exists and belongs to a community
    const { data: msg } = await db
      .from("community_messages")
      .select("id, community_id, media_path, media_type, viewed_at")
      .eq("id", params.id)
      .maybeSingle();

    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (!msg.media_path) return NextResponse.json({ error: "No media attached" }, { status: 400 });
    if (msg.viewed_at) return NextResponse.json({ error: "Already viewed" }, { status: 403 });

    // 2. Verify user is a member of this community
    const { data: membership } = await db
      .from("community_members")
      .select("id")
      .eq("community_id", msg.community_id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Atomic lock: Mark as viewed
    const { data: updated, error: updateError } = await db
      .from("community_messages")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", msg.id)
      .is("viewed_at", null)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Already viewed or expired" }, { status: 403 });
    }

    // 4. Generate signed URL
    const { data: signedUrlData, error: signedError } = await db.storage
      .from("community-media")
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
