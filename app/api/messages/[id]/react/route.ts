export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";

// Real emojis — must match QUICK_EMOJI in ChatRoom.tsx exactly.
// These were previously stored as mojibake (ðŸ˜‚ etc.), which broke
// reactions whenever the client sent the correct character.
const ALLOWED = ["😂", "😢", "😮", "❤️", "🔥", "👍", "👏", "🙏"];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    if (await isBanned(sessionId)) {
      return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
    }

    let body: { emoji?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "bad json" }, { status: 400 });
    }

    const emoji = String(body.emoji ?? "").trim();
    if (!ALLOWED.includes(emoji)) {
      return Response.json({ error: "Emoji not allowed" }, { status: 400 });
    }

    const db = createServiceClient();
    const messageId = params.id;

    // Look up the message's community and verify the caller is a member.
    // Prevents reacting to messages in spaces you haven't joined.
    const { data: msg } = await db
      .from("community_messages")
      .select("community_id, hidden")
      .eq("id", messageId)
      .maybeSingle();

    if (!msg) {
      return Response.json({ error: "message not found" }, { status: 404 });
    }
    if (msg.hidden) {
      return Response.json({ error: "message not found" }, { status: 404 });
    }

    const { data: membership } = await db
      .from("community_members")
      .select("id")
      .eq("community_id", msg.community_id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!membership) {
      return Response.json(
        { error: "Join the space first." },
        { status: 403 }
      );
    }

    const { data: existing } = await db
      .from("message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("session_id", sessionId)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existing) {
      await db.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await db.from("message_reactions").insert({
        id: nanoid(),
        message_id: messageId,
        session_id: sessionId,
        emoji
      });
    }

    const { data: all } = await db
      .from("message_reactions")
      .select("emoji")
      .eq("message_id", messageId);

    const counts = new Map<string, number>();
    for (const r of all ?? []) {
      counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    }

    const reactions = Array.from(counts.entries()).map(([emoji, count]) => ({
      emoji,
      count
    }));

    return Response.json({ ok: true, reactions });
  } catch (e) {
    console.error("[react]", e);
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}