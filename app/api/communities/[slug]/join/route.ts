export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCanWrite } from "@/lib/guards";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

  const denied = await assertCanWrite(sessionId);
  if (denied) return denied;

  await getOrCreateSessionProfile(sessionId);

  let body: { action?: "join" | "leave" };
  try {
    body = await req.json();
  } catch {
    body = { action: "join" };
  }
  const action = body.action ?? "join";

  const db = createServiceClient();
  const { data: community } = await db
    .from("communities")
    .select("id, owner_session_id")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!community) return Response.json({ error: "not found" }, { status: 404 });

  if (action === "leave") {
    if (community.owner_session_id === sessionId) {
      return Response.json(
        { error: "Owner cannot leave. Delete the community instead." },
        { status: 400 }
      );
    }
    await db
      .from("community_members")
      .delete()
      .eq("community_id", community.id)
      .eq("session_id", sessionId);
    return Response.json({ ok: true, joined: false });
  }

  const { data: existing } = await db
    .from("community_members")
    .select("id")
    .eq("community_id", community.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!existing) {
    await db.from("community_members").insert({
      id: nanoid(),
      community_id: community.id,
      session_id: sessionId,
      role: "member"
    });
  }

  return Response.json({ ok: true, joined: true });
}