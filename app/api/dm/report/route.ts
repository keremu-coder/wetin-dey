export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const sid = await getSessionId();
  if (!sid) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const limit = await checkRateLimit(
    sid,
    { key: "dm_report", limit: 20, windowMs: 60 * 60 * 1000 },
    { ip: getRequestIp(req) }
  );
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    messageId?: string;
    reason?: string;
  };
  if (!body.messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: msg } = await db
    .from("dm_messages")
    .select("id, thread_id, sender_id")
    .eq("id", body.messageId)
    .maybeSingle();

  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (msg.sender_id === sid) {
    return NextResponse.json(
      { error: "You can't report your own message." },
      { status: 400 }
    );
  }

  const { data: thread } = await db
    .from("dm_threads")
    .select("session_a, session_b")
    .eq("id", msg.thread_id)
    .maybeSingle();

  if (!thread || (thread.session_a !== sid && thread.session_b !== sid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Dedupe: if this user already flagged this exact message, no-op success
  const { data: dup } = await db
    .from("content_flags")
    .select("id")
    .eq("session_id", sid)
    .eq("target_type", "dm_message")
    .eq("target_id", body.messageId)
    .maybeSingle();
  if (dup) return NextResponse.json({ ok: true });

  const { error } = await db.from("content_flags").insert({
    session_id: sid,
    target_type: "dm_message",
    target_id: body.messageId,
    reason:
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.slice(0, 500)
        : "Reported via DM UI",
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error("[dm/report]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
