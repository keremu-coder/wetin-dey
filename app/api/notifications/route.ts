export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications
 *
 * Returns the current session's notifications, newest first, up to 50.
 * Cursor pagination via `?before=<ISO timestamp>` — pass the created_at
 * of the last row you received to fetch the next page.
 *
 * Actor handles are resolved in a single second query.
 */
export async function GET(req: NextRequest) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const url = new URL(req.url);
    const before = url.searchParams.get("before");

    const db = createServiceClient();

    let q = db
      .from("notifications")
      .select(
        "id, recipient_id, actor_id, kind, target_type, target_id, preview, created_at, read_at"
      )
      .eq("recipient_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (before) {
      q = q.lt("created_at", before);
    }

    const { data: rows, error } = await q;
    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    const list = rows ?? [];

    const actorIds = Array.from(
      new Set(
        list.map((r) => r.actor_id).filter((id): id is string => !!id)
      )
    );

    const handleMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: sessions } = await db
        .from("sessions")
        .select("id, handle")
        .in("id", actorIds);
      for (const s of sessions ?? []) {
        handleMap.set(s.id, s.handle);
      }
    }

    const output = list.map((r) => ({
      id: r.id,
      kind: r.kind,
      target_type: r.target_type,
      target_id: r.target_id,
      preview: r.preview,
      created_at: r.created_at,
      read_at: r.read_at,
      actor_handle: r.actor_id ? handleMap.get(r.actor_id) ?? null : null
    }));

    return Response.json({ notifications: output });
  } catch (e) {
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}