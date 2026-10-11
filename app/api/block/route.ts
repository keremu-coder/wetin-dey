export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();

    const { data: rows, error } = await db
      .from("blocked_users")
      .select("blocked_session_id, created_at")
      .eq("blocker_session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const ids = (rows ?? []).map((r) => r.blocked_session_id);
    if (ids.length === 0) {
      return Response.json({ blocked: [] });
    }

    const { data: sessions } = await db
      .from("sessions")
      .select("id, handle")
      .in("id", ids);

    const handleMap = new Map<string, string>();
    for (const s of sessions ?? []) {
      handleMap.set(s.id, s.handle);
    }

    return Response.json({
      blocked: (rows ?? []).map((r) => ({
        session_id: r.blocked_session_id,
        handle: handleMap.get(r.blocked_session_id) ?? "Anonymous",
        created_at: r.created_at
      }))
    });
  } catch (e) {
    console.error("[block GET]", e);
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const limit = await checkRateLimit(sessionId, {
      key: "block",
      limit: 30,
      windowMs: 60 * 60 * 1000
    }, { ip: getRequestIp(req) });
    if (!limit.ok) {
      return Response.json(
        { error: "Too many requests. Slow down." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      handle?: unknown;
      action?: unknown;
    };

    const handle =
      typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
    const action = body.action === "unblock" ? "unblock" : "block";

    if (!handle) {
      return Response.json({ error: "handle required" }, { status: 400 });
    }

    const db = createServiceClient();

    const { data: target, error: targetErr } = await db
      .from("sessions")
      .select("id, handle")
      .eq("handle_lower", handle)
      .maybeSingle();

    if (targetErr) {
      return Response.json({ error: targetErr.message }, { status: 500 });
    }
    if (!target) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }
    if (target.id === sessionId) {
      return Response.json(
        { error: "You can't block yourself." },
        { status: 400 }
      );
    }

    if (action === "unblock") {
      const { error } = await db
        .from("blocked_users")
        .delete()
        .eq("blocker_session_id", sessionId)
        .eq("blocked_session_id", target.id);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ ok: true, action: "unblock" });
    }

    const { error } = await db
      .from("blocked_users")
      .upsert(
        {
          blocker_session_id: sessionId,
          blocked_session_id: target.id
        },
        { onConflict: "blocker_session_id,blocked_session_id" }
      );

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, action: "block" });
  } catch (e) {
    console.error("[block POST]", e);
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}