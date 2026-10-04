export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

  let body: { vote?: "up" | "down" | "me_too" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const vote = body.vote;
  if (vote !== "up" && vote !== "down" && vote !== "me_too") {
    return Response.json({ error: "invalid vote" }, { status: 400 });
  }

  const db = createServiceClient();
  const postId = params.id;

  // Check existing vote by this session on this post
  const { data: existing } = await db
    .from("post_votes")
    .select("id, vote")
    .eq("post_id", postId)
    .eq("session_id", sessionId)
    .maybeSingle();

  // Same vote → remove (toggle off)
  if (existing && existing.vote === vote) {
    await db.from("post_votes").delete().eq("id", existing.id);
  } else {
    // Delete any existing vote, then insert the new one
    if (existing) {
      await db.from("post_votes").delete().eq("id", existing.id);
    }
    await db.from("post_votes").insert({
      id: nanoid(),
      post_id: postId,
      session_id: sessionId,
      vote
    });
  }

  // Recount all
  const { data: allVotes } = await db
    .from("post_votes")
    .select("vote")
    .eq("post_id", postId);

  const upvotes = (allVotes ?? []).filter((v) => v.vote === "up").length;
  const downvotes = (allVotes ?? []).filter((v) => v.vote === "down").length;
  const meToo = (allVotes ?? []).filter((v) => v.vote === "me_too").length;

  await db
    .from("reports")
    .update({ upvotes, downvotes, me_too_count: meToo })
    .eq("id", postId);

  // Return the current session's vote state too
  const { data: refreshed } = await db
    .from("post_votes")
    .select("vote")
    .eq("post_id", postId)
    .eq("session_id", sessionId)
    .maybeSingle();

  return Response.json({
    ok: true,
    upvotes,
    downvotes,
    me_too: meToo,
    my_vote: refreshed?.vote ?? null
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = await getSessionId();
  const db = createServiceClient();

  const { data: post } = await db
    .from("reports")
    .select("upvotes, downvotes, me_too_count")
    .eq("id", params.id)
    .maybeSingle();

  let my_vote: string | null = null;
  if (sessionId) {
    const { data: mine } = await db
      .from("post_votes")
      .select("vote")
      .eq("post_id", params.id)
      .eq("session_id", sessionId)
      .maybeSingle();
    my_vote = mine?.vote ?? null;
  }

  return Response.json({
    upvotes: post?.upvotes ?? 0,
    downvotes: post?.downvotes ?? 0,
    me_too: post?.me_too_count ?? 0,
    my_vote
  });
}