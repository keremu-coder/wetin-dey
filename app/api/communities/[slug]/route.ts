export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
    const params = await context.params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("communities")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();
  if (error) return Response.json({ error: "Server error" }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ community: data });
}

export async function DELETE(req: NextRequest,
  context: { params: Promise<{ slug: string }> }) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

    const params = await context.params;
  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

  const db = createServiceClient();
  const { data: community } = await db
    .from("communities")
    .select("id, owner_session_id")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!community) return Response.json({ error: "not found" }, { status: 404 });
  if (community.owner_session_id !== sessionId) {
    return Response.json({ error: "not owner" }, { status: 403 });
  }

  await db.from("communities").delete().eq("id", community.id);
  return Response.json({ ok: true });
}