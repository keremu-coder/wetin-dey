export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeMessage, blockReason } from "@/lib/dm-filter";
import { DM_BODY_MAX } from "@/lib/dm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const me = await getOrCreateSessionProfile(sessionId);
    if (!me) {
      return Response.json({ error: "no profile" }, { status: 500 });
    }

    const db = createServiceClient();

    const { data: thread } = await db
      .from("dm_threads")
      .select("id, session_a, session_b")
      .eq("id", params.id)
      .maybeSingle();

    if (!thread) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (thread.session_a !== sessionId && thread.session_b !== sessionId) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { body?: unknown };
    if (typeof body.body !== "string") {
      return Response.json({ error: "body required" }, { status: 400 });
    }

    const text = body.body.trim();
    if (text.length < 1) {
      return Response.json({ error: "Empty message" }, { status: 400 });
    }
    if (text.length > DM_BODY_MAX) {
      return Response.json(
        { error: `Max ${DM_BODY_MAX} characters.` },
        { status: 400 }
      );
    }

    // ─── Contact-info filter ───
    const analysis = analyzeMessage(text);

    if (analysis.level === "block") {
      const reason =
        blockReason(analysis) ??
        "This message contains contact info and can't be sent.";

      // Log the violation for enforcement history (Session D uses this).
      try {
        await db.from("dm_violations").insert({
          id: nanoid(),
          session_id: sessionId,
          thread_id: thread.id,
          kind: analysis.matches[0]?.kind ?? "unknown",
          excerpt: text.slice(0, 200)
        });
      } catch {
        /* non-fatal */
      }

      return Response.json(
        {
          ok: false,
          blocked: true,
          reason,
          kinds: analysis.matches.map((m) => m.kind)
        },
        { status: 400 }
      );
    }

    const id = nanoid();
    const { data, error } = await db
      .from("dm_messages")
      .insert({
        id,
        thread_id: thread.id,
        sender_id: sessionId,
        body: text,
        filter_level: analysis.level,
        held: false
      })
      .select("id, sender_id, body, created_at, held, filter_level")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Bump thread activity
    await db
      .from("dm_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", thread.id);

    return Response.json({ ok: true, message: data });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}