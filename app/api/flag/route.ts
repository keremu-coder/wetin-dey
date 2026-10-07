export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, sameOrigin } from "@/lib/rate-limit";

const VALID_TARGETS = ["message", "community", "comment"] as const;
type Target = (typeof VALID_TARGETS)[number];

const VALID_REASONS = [
  "spam",
  "harassment",
  "hate",
  "misinformation",
  "scam",
  "other"
] as const;
type Reason = (typeof VALID_REASONS)[number];

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
      key: "content_flag",
      limit: 20,
      windowMs: 60 * 60 * 1000
    });
    if (!limit.ok) {
      return Response.json(
        { error: "Too many reports. Try again later." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      target_type?: unknown;
      target_id?: unknown;
      reason?: unknown;
      note?: unknown;
    };

    if (
      typeof body.target_type !== "string" ||
      !VALID_TARGETS.includes(body.target_type as Target)
    ) {
      return Response.json({ error: "invalid target" }, { status: 400 });
    }
    if (typeof body.target_id !== "string" || !body.target_id) {
      return Response.json({ error: "target_id required" }, { status: 400 });
    }
    if (
      typeof body.reason !== "string" ||
      !VALID_REASONS.includes(body.reason as Reason)
    ) {
      return Response.json({ error: "invalid reason" }, { status: 400 });
    }

    const note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim().slice(0, 500)
        : null;

    const db = createServiceClient();

    // ─── Self-flag guard ───
    // Don't let a session flag their own content. Waste of moderator time.
    if (body.target_type === "message") {
      const { data: msg } = await db
        .from("community_messages")
        .select("session_id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (msg?.session_id === sessionId) {
        return Response.json(
          { error: "You can't report your own message." },
          { status: 400 }
        );
      }
    } else if (body.target_type === "comment") {
      const { data: comment } = await db
        .from("comments")
        .select("session_id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (comment?.session_id === sessionId) {
        return Response.json(
          { error: "You can't report your own comment." },
          { status: 400 }
        );
      }
    } else if (body.target_type === "community") {
      const { data: community } = await db
        .from("communities")
        .select("owner_session_id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (community?.owner_session_id === sessionId) {
        return Response.json(
          { error: "You can't report your own space." },
          { status: 400 }
        );
      }
    }

    const { error } = await db.from("content_flags").upsert(
      {
        session_id: sessionId,
        target_type: body.target_type,
        target_id: body.target_id,
        reason: body.reason,
        note
      },
      { onConflict: "session_id,target_type,target_id" }
    );

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}