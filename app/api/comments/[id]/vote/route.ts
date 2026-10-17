export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import { serverError } from "@/lib/http";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest,
  context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  const params = await context.params;
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    if (await isBanned(sessionId)) {
      return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
    }

    const limit = await checkRateLimit(
      sessionId,
      { key: "comment_vote", limit: 30, windowMs: 60 * 1000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many votes." }, { status: 429 });
    }

    let body: { vote?: "up" | "down" };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "bad json" }, { status: 400 });
    }

    const vote = body.vote;
    if (vote !== "up" && vote !== "down") {
      return Response.json({ error: "invalid vote" }, { status: 400 });
    }

    const db = createServiceClient();
    const commentId = params.id;

    const { data: existing } = await db
      .from("comment_votes")
      .select("id, vote")
      .eq("comment_id", commentId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existing && existing.vote === vote) {
      await db.from("comment_votes").delete().eq("id", existing.id);
    } else {
      if (existing) {
        await db.from("comment_votes").delete().eq("id", existing.id);
      }
      await db.from("comment_votes").insert({
        id: nanoid(),
        comment_id: commentId,
        session_id: sessionId,
        vote
      });
    }

    const { data: allVotes } = await db
      .from("comment_votes")
      .select("vote")
      .eq("comment_id", commentId);

    const upvotes = (allVotes ?? []).filter((v) => v.vote === "up").length;
    const downvotes = (allVotes ?? []).filter((v) => v.vote === "down").length;

    await db
      .from("comments")
      .update({ upvotes, downvotes })
      .eq("id", commentId);

    const { data: refreshed } = await db
      .from("comment_votes")
      .select("vote")
      .eq("comment_id", commentId)
      .eq("session_id", sessionId)
      .maybeSingle();

    return Response.json({
      ok: true,
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      my_vote: refreshed?.vote ?? null
    });
  } catch (e) {
    console.error("[comment vote] unexpected:", e);
    return serverError("comments/[id]/vote", e);
  }
}
