export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/lib/blocks";
import { canSeePhoto } from "@/lib/photo-visibility";

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const rawQ = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/^@/, "");
  if (!rawQ || rawQ.length < 2) {
    return Response.json({ users: [] });
  }

  const q = escapeLike(rawQ);

  const sessionId = await getSessionId();
  const blockedIds = await getBlockedIds(sessionId);
  const blockedList = Array.from(blockedIds);

  const db = createServiceClient();
  let query = db
    .from("sessions")
    .select("id, handle, handle_kind, follower_count, post_count, avatar_url, photo_visibility")
    .ilike("handle", `%${q}%`)
    .limit(20);

  if (blockedList.length > 0) {
    query = query.not("id", "in", `(${blockedList.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: "Server error" }, { status: 500 });
  }

  let myFollowingSet = new Set<string>();
  if (sessionId && data && data.length > 0) {
    const targetIds = data.map((u) => u.id);
    const { data: followRows } = await db
      .from("follows")
      .select("followed_session_id")
      .eq("follower_session_id", sessionId)
      .in("followed_session_id", targetIds);
    myFollowingSet = new Set((followRows ?? []).map((f) => f.followed_session_id));
  }

  const users = (data ?? []).map((u) => {
    const canSee = canSeePhoto({
      viewerId: sessionId,
      targetId: u.id,
      visibility: u.photo_visibility as any,
      isFollowing: myFollowingSet.has(u.id)
    });

    return {
      handle: u.handle,
      handle_kind: u.handle_kind,
      follower_count: u.follower_count,
      post_count: u.post_count,
      avatar_url: canSee ? u.avatar_url : null
    };
  });

  return Response.json({ users });
}
