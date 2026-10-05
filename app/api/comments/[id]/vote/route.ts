export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
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

    // Check existing vote by this session
    const { data: existing } = await db
      .from("comment_votes")
      .select("id, vote")
      .eq("comment_id", commentId)
      .eq("session_id", sessionId)
      .maybeSingle();

    // Same vote → toggle off
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

    // Recount
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

    // What's this session's current vote?
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
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}