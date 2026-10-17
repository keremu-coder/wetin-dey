export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ ok: false });
    }

    const db = createServiceClient();
    await db
      .from("sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", sessionId);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}