export const runtime = "nodejs";

import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const sessionId = await getSessionId();
  if (!sessionId) {
    // The client distinguishes "session cookie is stale" (recoverable by
    // clearing and reloading) from other errors. Middleware does not clear
    // a stale cookie because HMAC still verifies; this code tells the client
    // to hit /api/session/reset once.
    return Response.json(
      { error: "no session", code: "session_expired" },
      { status: 401 }
    );
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