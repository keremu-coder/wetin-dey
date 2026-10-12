export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) return Response.json({ spaces: [] });

    const db = createServiceClient();

    // My spaces
    const { data: memberRows } = await db
      .from("community_members")
      .select("community_id")
      .eq("session_id", sessionId);

    const communityIds = (memberRows ?? []).map((m) => m.community_id);
    if (communityIds.length === 0) {
      return Response.json({ spaces: [] });
    }

    const [communitiesRes, checkinsRes] = await Promise.all([
      db
        .from("communities")
        .select("id, slug, name, emoji, avatar_url")
        .in("id", communityIds),
      db
        .from("checkin_requests")
        .select("id, community_id, reason, created_at, expires_at")
        .in("community_id", communityIds)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    ]);

    const communityMap = new Map(
      (communitiesRes.data ?? []).map((c) => [c.id, c])
    );

    const activeCheckins = checkinsRes.data ?? [];
    const requestIds = activeCheckins.map((c) => c.id);

    // Members per active check-in's community + responses
    const spaces: Array<{
      community_id: string;
      slug: string;
      name: string;
      emoji: string;
      avatar_url: string | null;
      request_id: string | null;
      reason: string | null;
      started_at: string | null;
      total_members: number;
      answered: number;
      pending: number;
      help_count: number;
    }> = [];

    // Preload member counts for all involved communities
    const { data: allMembers } = await db
      .from("community_members")
      .select("community_id, session_id")
      .in("community_id", communityIds);

    const memberCountByCommunity = new Map<string, number>();
    for (const m of allMembers ?? []) {
      memberCountByCommunity.set(
        m.community_id,
        (memberCountByCommunity.get(m.community_id) ?? 0) + 1
      );
    }

    const responsesByRequest = new Map<string, Array<{ status: string }>>();
    if (requestIds.length > 0) {
      const { data: responses } = await db
        .from("checkin_responses")
        .select("request_id, status")
        .in("request_id", requestIds);

      for (const r of responses ?? []) {
        const list = responsesByRequest.get(r.request_id) ?? [];
        list.push({ status: r.status });
        responsesByRequest.set(r.request_id, list);
      }
    }

    const checkinByCommunity = new Map<
      string,
      (typeof activeCheckins)[number]
    >();
    for (const c of activeCheckins) {
      if (!checkinByCommunity.has(c.community_id)) {
        checkinByCommunity.set(c.community_id, c);
      }
    }

    for (const cid of communityIds) {
      const c = communityMap.get(cid);
      if (!c) continue;
      const active = checkinByCommunity.get(cid);
      const responses = active
        ? responsesByRequest.get(active.id) ?? []
        : [];
      const helpCount = responses.filter((r) => r.status === "help").length;

      spaces.push({
        community_id: cid,
        slug: c.slug,
        name: c.name,
        emoji: c.emoji,
        avatar_url: c.avatar_url ?? null,
        request_id: active?.id ?? null,
        reason: active?.reason ?? null,
        started_at: active?.created_at ?? null,
        total_members: memberCountByCommunity.get(cid) ?? 0,
        answered: responses.length,
        pending: Math.max(
          (memberCountByCommunity.get(cid) ?? 0) - responses.length,
          0
        ),
        help_count: helpCount
      });
    }

    // Spaces with active check-ins first, then by name
    spaces.sort((a, b) => {
      if (a.request_id && !b.request_id) return -1;
      if (!a.request_id && b.request_id) return 1;
      return a.name.localeCompare(b.name);
    });

    return Response.json({ spaces });
  } catch (e) {
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}