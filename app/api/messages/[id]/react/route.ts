export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";

const ALLOWED = ["😂", "😢", "😮", "❤️", "🔥", "👍", "👏", "🙏"];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}