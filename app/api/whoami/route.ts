export const runtime = "nodejs";

import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) {
    return Response.json({ error: "profile failed" }, { status: 500 });
  }

  const db = createServiceClient();
  const { data: session } = await db
    .from("sessions")
    .select("email_verified_at")
    .eq("id", sessionId)
    .maybeSingle();

  return Response.json({
    id: profile.id,
    handle: profile.handle,
    handle_kind: profile.handle_kind,
    email_verified: session?.email_verified_at != null
  });
}