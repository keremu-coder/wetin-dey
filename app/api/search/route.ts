export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/lib/blocks";

/**
 * Escape `%` and `_` so a user typing them doesn't turn into a wildcard.
 * Postgres LIKE treats `\` as the default escape character.
 */
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
    .select("id, handle, handle_kind, follower_count, post_count")
    .ilike("handle", `%${q}%`)
    .limit(20);

  if (blockedList.length > 0) {
    query = query.not("id", "in", `(${blockedList.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: "Server error" }, { status: 500 });
  }

  // Strip id — client only needs handle + counts
  const users = (data ?? []).map((u) => ({
    handle: u.handle,
    handle_kind: u.handle_kind,
    follower_count: u.follower_count,
    post_count: u.post_count
  }));

  return Response.json({ users });
}