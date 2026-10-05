export const runtime = "nodejs";

import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST() {
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