export const runtime = "nodejs";

import { NextRequest } from "next/server";
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

    const { data: members, error } = await db
      .from("community_members")
      .select("session_id, role, joined_at")
      .eq("community_id", community.id)
      .order("joined_at", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const ids = (members ?? []).map((m) => m.session_id);
    const profileMap = new Map<
      string,
      { handle: string; last_seen_at: string | null }
    >();

    if (ids.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle, last_seen_at")
        .in("id", ids);

      for (const p of profiles ?? []) {
        profileMap.set(p.id, {
          handle: p.handle,
          last_seen_at: p.last_seen_at ?? null
        });
      }
    }

    const output = (members ?? []).map((m) => ({
      session_id: m.session_id,
      handle: profileMap.get(m.session_id)?.handle ?? "Anonymous",
      last_seen_at: profileMap.get(m.session_id)?.last_seen_at ?? null,
      role: m.role,
      joined_at: m.joined_at
    }));

    return Response.json({ members: output });
  } catch (e) {
    console.error("[members]", e);
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}