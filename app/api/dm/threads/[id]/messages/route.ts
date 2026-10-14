export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { waitUntil } from "@vercel/functions";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeMessage, analyzeModeration, blockReason } from "@/lib/dm-filter";
import { DM_BODY_MAX } from "@/lib/dm";
import { notifyDMRecipient } from "@/lib/push-server";
import { sameOrigin } from "@/lib/rate-limit";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "@/lib/terms-guard";
import { serverError } from "@/lib/http";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    if (await isBanned(sessionId)) {
      return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
    }

    if (!(await hasAcceptedTerms(sessionId))) {
      return Response.json(
        { error: TERMS_NOT_ACCEPTED_MESSAGE, code: TERMS_NOT_ACCEPTED_CODE },
        { status: 403 }
      );
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

    const recipientId =
      thread.session_a === sessionId ? thread.session_b : thread.session_a;

    const [blockedByMe, blockedByThem] = await Promise.all([
      db
        .from("blocked_users")
        .select("id")
        .eq("blocker_session_id", sessionId)
        .eq("blocked_session_id", recipientId)
        .maybeSingle(),
      db
        .from("blocked_users")
        .select("id")
        .eq("blocker_session_id", recipientId)
        .eq("blocked_session_id", sessionId)
        .maybeSingle()
    ]);

    if (blockedByMe.data || blockedByThem.data) {
      return Response.json(
        { error: "You can't send messages in this conversation." },
        { status: 403 }
      );
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

    const analysis = analyzeMessage(text);

    if (analysis.level === "block") {
      const reason =
        blockReason(analysis) ??
        "This message contains contact info and can't be sent.";

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

    // Text-moderation filter (threats, hate, profanity). On match, hold
    // the message so the recipient does not see it — same semantics as
    // community chat and comments.
    const mod = analyzeModeration(text);
    const held = mod.hold;
    if (held) {
      try {
        await db.from("dm_violations").insert({
          id: nanoid(),
          session_id: sessionId,
          thread_id: thread.id,
          kind: mod.matches[0]?.kind ?? "moderation",
          excerpt: text.slice(0, 200)
        });
      } catch { /* non-fatal */ }
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
        held
      })
      .select("id, sender_id, body, created_at, held, filter_level, read_at")
      .single();

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    await db
      .from("dm_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", thread.id);

    waitUntil(
      notifyDMRecipient({
        recipientSessionId: recipientId,
        senderHandle: me.handle,
        threadId: thread.id,
        body: text
      }).catch((err) => {
        console.error("[dm push]", err);
      })
    );

    return Response.json({ ok: true, message: data });
  } catch (e) {
    return serverError("dm/threads/[id]/messages", e);
  }
}