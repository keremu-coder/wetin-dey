export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCanWrite } from "@/lib/guards";

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

export async function POST(req: NextRequest) {
  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

  const denied = await assertCanWrite(sessionId);
  if (denied) return denied;

  const me = await getOrCreateSessionProfile(sessionId);
  if (!me) return Response.json({ error: "no profile" }, { status: 500 });

  let body: { handle?: string; action?: "follow" | "unfollow" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const targetHandle = String(body.handle ?? "").trim();
  const action = body.action ?? "follow";

  if (!targetHandle) return Response.json({ error: "handle required" }, { status: 400 });
  if (targetHandle.toLowerCase() === me.handle.toLowerCase()) {
    return Response.json({ error: "you cannot follow yourself" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: target } = await db
    .from("sessions")
    .select("id, handle")
    .eq("handle_lower", targetHandle.toLowerCase())
    .maybeSingle();

  if (!target) return Response.json({ error: "profile not found" }, { status: 404 });

  if (action === "follow") {
    const { error } = await db
      .from("follows")
      .insert({
        id: nanoid(),
        follower_session_id: sessionId,
        followed_session_id: target.id
      });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await db
      .from("follows")
      .delete()
      .eq("follower_session_id", sessionId)
      .eq("followed_session_id", target.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  const { count: followerCount } = await db
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("followed_session_id", target.id);

  const { count: followingCount } = await db
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_session_id", sessionId);

  await db
    .from("sessions")
    .update({ follower_count: followerCount ?? 0 })
    .eq("id", target.id);

  await db
    .from("sessions")
    .update({ following_count: followingCount ?? 0 })
    .eq("id", sessionId);

  return Response.json({
    ok: true,
    following: action === "follow",
    follower_count: followerCount ?? 0
  });
}