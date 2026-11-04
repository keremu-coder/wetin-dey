import { createServiceClient } from "@/lib/supabase/server";

/** Can this session see/play games in this community or DM thread? */
export async function canAccessSpace(
  db: ReturnType<typeof createServiceClient>,
  sid: string,
  communityId?: unknown,
  dmThreadId?: unknown
): Promise<boolean> {
  if (communityId && typeof communityId === "string") {
    const { data: c } = await db.from("communities").select("is_public").eq("id", communityId).maybeSingle();
    if (!c) return false;
    if (c.is_public) return true;
    const { data: m } = await db.from("community_members").select("id").eq("community_id", communityId).eq("session_id", sid).maybeSingle();
    return !!m;
  }
  if (dmThreadId && typeof dmThreadId === "string") {
    const { data: t } = await db.from("dm_threads").select("session_a, session_b").eq("id", dmThreadId).maybeSingle();
    return !!t && (t.session_a === sid || t.session_b === sid);
  }
  return false;
}
