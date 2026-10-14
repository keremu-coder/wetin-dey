export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCanWrite } from "@/lib/guards";
import {
  CHECKIN_MAX_NOTE,
  isValidCheckinStatus
} from "@/lib/checkin";
import { serverError } from "@/lib/http";
import { sameOrigin } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
    const params = await context.params;
  try {
    const db = createServiceClient();

    const { data: community } = await db
      .from("communities")
      .select("id, name")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const sessionId = await getSessionId();

    const { data: memberRows } = await db
      .from("community_members")
      .select("session_id, role")
      .eq("community_id", community.id);

    const memberSessionIds = (memberRows ?? []).map((m) => m.session_id);

    const handleMap = new Map<string, string>();
    if (memberSessionIds.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle")
        .in("id", memberSessionIds);
      for (const p of profiles ?? []) {
        handleMap.set(p.id, p.handle);
      }
    }

    const nowIso = new Date().toISOString();
    const { data: request } = await db
      .from("checkin_requests")
      .select("id, session_id, reason, created_at, expires_at")
      .eq("community_id", community.id)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let responses: Array<{
      session_id: string;
      status: string;
      note: string | null;
      created_at: string;
    }> = [];

    if (request) {
      const { data: respRows } = await db
        .from("checkin_responses")
        .select("session_id, status, note, created_at")
        .eq("request_id", request.id)
        .order("created_at", { ascending: false });
      responses = respRows ?? [];
    }

    const my_response = request
      ? responses.find((r) => r.session_id === sessionId) ?? null
      : null;

    return Response.json({
      community: { id: community.id, name: community.name },
      request: request
        ? {
            ...request,
            started_by_handle:
              handleMap.get(request.session_id) ?? "Anonymous"
          }
        : null,
      responses: responses.map((r) => ({
        ...r,
        handle: handleMap.get(r.session_id) ?? "Anonymous"
      })),
      members: memberSessionIds.map((id) => ({
        session_id: id,
        handle: handleMap.get(id) ?? "Anonymous",
        role:
          (memberRows ?? []).find((m) => m.session_id === id)?.role ??
          "member"
      })),
      my_response
    });
  } catch (e) {
    return serverError("communities/[slug]/checkins", e);
  }
}

export async function POST(req: NextRequest,
  context: { params: Promise<{ slug: string }> }) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

    const params = await context.params;
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const profile = await getOrCreateSessionProfile(sessionId);
    if (!profile) {
      return Response.json({ error: "no profile" }, { status: 500 });
    }

    const db = createServiceClient();

    const { data: community } = await db
      .from("communities")
      .select("id")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const { data: membership } = await db
      .from("community_members")
      .select("id")
      .eq("community_id", community.id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!membership) {
      return Response.json({ error: "Join the space first." }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const { data: request } = await db
      .from("checkin_requests")
      .select("id")
      .eq("community_id", community.id)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!request) {
      return Response.json(
        { error: "No check-in in progress." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as {
      status?: unknown;
      note?: unknown;
    };

    if (!isValidCheckinStatus(body.status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }

    const note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim().slice(0, CHECKIN_MAX_NOTE)
        : null;

    const { error } = await db.from("checkin_responses").upsert(
      {
        request_id: request.id,
        session_id: sessionId,
        status: body.status,
        note,
        created_at: new Date().toISOString()
      },
      { onConflict: "request_id,session_id" }
    );

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      handle: profile.handle,
      status: body.status
    });
  } catch (e) {
    return serverError("communities/[slug]/checkins", e);
  }
}