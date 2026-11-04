export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";

// Explicit column list. Never select("*") here — that leaked
// owner_session_id (audit finding 3) to any caller who knew the slug.
// owner_session_id is still selected internally so we can compute
// is_owner for the caller, but it is stripped from the response.
const COMMUNITY_COLUMNS =
  "id, slug, name, description, emoji, is_public, member_count, post_count, created_at, avatar_url, owner_session_id";

type CommunityRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  is_public: boolean;
  member_count: number;
  post_count: number;
  created_at: string;
  avatar_url: string | null;
  owner_session_id: string | null;
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("communities")
    .select(COMMUNITY_COLUMNS)
    .eq("slug", params.slug)
    .maybeSingle();

  if (error) return Response.json({ error: "Server error" }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  const { owner_session_id, ...publicRow } = data as CommunityRow;
  const viewer = await getSessionId();
  const is_owner = !!viewer && viewer === owner_session_id;

  return Response.json({ community: { ...publicRow, is_owner } });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  const params = await context.params;
  const sessionId = await getSessionId();
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  // Ban check — previously missing on this route (audit finding 16).
  if (await isBanned(sessionId)) {
    return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
  }

  // Rate limit — previously missing. 5 deletes per hour is generous.
  const limit = await checkRateLimit(
    sessionId,
    { key: "community_delete", limit: 5, windowMs: 60 * 60 * 1000 },
    { ip: getRequestIp(req) }
  );
  if (!limit.ok) {
    return Response.json({ error: "Slow down — try again later." }, { status: 429 });
  }

  const db = createServiceClient();
  const { data: community } = await db
    .from("communities")
    .select("id, owner_session_id, avatar_url")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!community) return Response.json({ error: "not found" }, { status: 404 });
  if (community.owner_session_id !== sessionId) {
    return Response.json({ error: "not owner" }, { status: 403 });
  }

  // Clean up storage (audit finding 16): space avatar, broadcast audio,
  // chat voice notes. All live in public buckets, so leaving them behind
  // means the files remain reachable at their URLs after the community
  // row is gone. Best-effort: don't fail the delete if a bucket call
  // errors (the row must go).
  try {
    if (community.avatar_url) {
      const marker = "/storage/v1/object/public/space-avatars/";
      const i = community.avatar_url.indexOf(marker);
      if (i >= 0) {
        const path = community.avatar_url.slice(i + marker.length);
        await db.storage.from("space-avatars").remove([path]);
      }
    }
  } catch (e) {
    console.warn("[community DELETE] avatar cleanup failed:", e);
  }

  for (const prefix of [`broadcasts/${community.id}`, `chat/${community.id}`]) {
    try {
      const { data: files } = await db.storage
        .from("voice-notes")
        .list(prefix, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${prefix}/${f.name}`);
        await db.storage.from("voice-notes").remove(paths);
      }
    } catch (e) {
      console.warn(`[community DELETE] ${prefix} cleanup failed:`, e);
    }
  }

  await db.from("communities").delete().eq("id", community.id);
  return Response.json({ ok: true });
}
