export const runtime = "nodejs";

import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";

export async function GET() {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return Response.json({ error: "no session" }, { status: 401 });
  }

  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) {
    return Response.json({ error: "profile failed" }, { status: 500 });
  }

  return Response.json({
    id: profile.id,
    handle: profile.handle,
    handle_kind: profile.handle_kind
  });
}