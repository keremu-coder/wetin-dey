export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const db = createServiceClient();

    const { data: community } = await db
      .from("communities")
      .select("id")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const sessionId = await getSessionId();

    // If the requester hides their presence, they don't see anyone else's.
    let requesterHides = false;
    if (sessionId) {
      const { data: me } = await db
        .from("sessions")
        .select("hide_presence")
        .eq("id", sessionId)
        .maybeSingle();
      requesterHides = me?.hide_presence === true;
    }

    const { data: memberRows } = await db
      .from("community_members")
      .select("session_id, role")
      .eq("community_id", community.id);

    const ids = (memberRows ?? []).map((m) => m.session_id);
    if (ids.length === 0) {
      return Response.json({ members: [] });
    }

    const { data: sessions } = await db
      .from("sessions")
      .select("id, handle, last_seen_at, hide_presence")
      .in("id", ids);

    const roleMap = new Map(
      (memberRows ?? []).map((m) => [m.session_id, m.role])
    );

    const members = (sessions ?? []).map((s) => {
      const targetHides =
        requesterHides || (s as { hide_presence?: boolean }).hide_presence === true;
      return {
        session_id: s.id,
        handle: s.handle,
        role: roleMap.get(s.id) ?? "member",
        last_seen_at: targetHides ? null : s.last_seen_at
      };
    });

    return Response.json({ members });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}