export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertNotBanned } from "@/lib/guards";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "bad origin" }, { status: 403 });
    const sessionId = await getSessionId();
    if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

    const denied = await assertNotBanned(sessionId);
    if (denied) return denied;

    const limit = await checkRateLimit(
      sessionId,
      { key: "livekit_token", limit: 30, windowMs: 10 * 60 * 1000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) return Response.json({ error: "Too many requests." }, { status: 429 });

    const profile = await getOrCreateSessionProfile(sessionId);
    if (!profile) return Response.json({ error: "no profile" }, { status: 500 });

    let body: { room_name?: unknown };
    try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

    const roomName = body.room_name;
    if (!roomName || typeof roomName !== "string" || roomName.length > 120) {
      return Response.json({ error: "room_name required" }, { status: 400 });
    }

    const db = createServiceClient();

    if (roomName.startsWith("dm_")) {
      // DM room: caller must be in the thread AND neither side may have
      // blocked the other (Guideline 1.2: blocking must stop contact).
      const threadId = roomName.slice(3);
      const { data: thread } = await db
        .from("dm_threads")
        .select("session_a, session_b")
        .eq("id", threadId)
        .maybeSingle();

      if (!thread || (thread.session_a !== sessionId && thread.session_b !== sessionId)) {
        return Response.json({ error: "You are not part of this DM." }, { status: 403 });
      }
      const otherId = thread.session_a === sessionId ? thread.session_b : thread.session_a;
      const { data: blocks } = await db
        .from("blocked_users")
        .select("id")
        .or(
          `and(blocker_session_id.eq.${sessionId},blocked_session_id.eq.${otherId}),` +
          `and(blocker_session_id.eq.${otherId},blocked_session_id.eq.${sessionId})`
        )
        .limit(1);
      if (blocks && blocks.length > 0) {
        return Response.json({ error: "You can't call this person." }, { status: 403 });
      }
    } else {
      // Space room: the room name is the space slug. Private spaces
      // require membership; unknown slugs get nothing.
      const { data: community } = await db
        .from("communities")
        .select("id, is_public")
        .eq("slug", roomName)
        .maybeSingle();
      if (!community) return Response.json({ error: "not found" }, { status: 404 });

      if (!community.is_public) {
        const { data: membership } = await db
          .from("community_members")
          .select("id")
          .eq("community_id", community.id)
          .eq("session_id", sessionId)
          .maybeSingle();
        if (!membership) return Response.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.error("[livekit/token] LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing");
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: sessionId,
      name: profile.handle,
      ttl: "2h"
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return Response.json({ token: await at.toJwt() });
  } catch (e) {
    console.error("[livekit/token]", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}