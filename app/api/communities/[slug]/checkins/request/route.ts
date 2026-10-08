export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToSessions } from "@/lib/push-server";
import { CHECKIN_REASON_MAX } from "@/lib/checkin";
import { assertCanWrite } from "@/lib/guards";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
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
      .select("id, name, slug, owner_session_id")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (community.owner_session_id !== sessionId) {
      return Response.json(
        { error: "Only the space owner can start a check-in." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      reason?: unknown;
    };
    const reason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, CHECKIN_REASON_MAX)
        : null;

    await db
      .from("checkin_requests")
      .update({ expires_at: new Date().toISOString() })
      .eq("community_id", community.id)
      .gt("expires_at", new Date().toISOString());

    const { data: request, error } = await db
      .from("checkin_requests")
      .insert({
        community_id: community.id,
        session_id: sessionId,
        reason
      })
      .select("id, reason, created_at, expires_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    void (async () => {
      try {
        const { data: members } = await db
          .from("community_members")
          .select("session_id")
          .eq("community_id", community.id);

        const recipients = (members ?? [])
          .map((m) => m.session_id)
          .filter((id) => id && id !== sessionId);

        if (recipients.length === 0) return;

        await sendPushToSessions(recipients, {
          title: `🔔 Check-in from ${community.name}`,
          body:
            reason ??
            `@${profile.handle} is checking on everyone. Tap to reply.`,
          tag: `checkin-${request.id}`,
          url: `/c/${community.slug}/checkin`
        });
      } catch (err) {
        console.error("[checkin push]", err);
      }
    })();

    return Response.json({ ok: true, request });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}