export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, sameOrigin } from "@/lib/rate-limit";
import { AUTO_HIDE_FLAG_THRESHOLD } from "@/lib/constants";
import { assertNotBanned } from "@/lib/guards";

const VALID_TARGETS = [
  "message",
  "community",
  "comment",
  "post",
  "report",
  "dm_thread",
  "dm_message",
  "user",
  "broadcast"
] as const;
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

async function applyAutoHide(
  db: ReturnType<typeof createServiceClient>,
  targetType: string,
  targetId: string
): Promise<boolean> {
  if (targetType === "message") {
    const { error } = await db
      .from("community_messages")
      .update({ hidden: true })
      .eq("id", targetId)
      .eq("hidden", false);
    return !error;
  }
  if (targetType === "comment") {
    const { error } = await db
      .from("comments")
      .update({ hidden: true })
      .eq("id", targetId)
      .eq("hidden", false);
    return !error;
  }
  if (targetType === "post" || targetType === "report") {
    const { error } = await db
      .from("reports")
      .update({ held: true })
      .eq("id", targetId)
      .eq("held", false);
    return !error;
  }
  if (targetType === "dm_message") {
    const { error } = await db
      .from("dm_messages")
      .update({ held: true })
      .eq("id", targetId)
      .eq("held", false);
    return !error;
  }
  if (targetType === "broadcast") {
    const { error } = await db
      .from("broadcasts")
      .update({ hidden: true })
      .eq("id", targetId)
      .eq("hidden", false);
    return !error;
  }
  return false;
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

    const denied = await assertNotBanned(sessionId);
    if (denied) return denied;

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

    // Self-flag guards: reject if the caller owns the target.
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
    } else if (body.target_type === "post") {
      const { data: post } = await db
        .from("reports")
        .select("session_id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (post?.session_id === sessionId) {
        return Response.json(
          { error: "You can't report your own post." },
          { status: 400 }
        );
      }
    } else if (body.target_type === "report") {
      const { data: report } = await db
        .from("reports")
        .select("session_id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (report?.session_id === sessionId) {
        return Response.json(
          { error: "You can't report your own report." },
          { status: 400 }
        );
      }
    } else if (body.target_type === "dm_thread") {
      const { data: thread } = await db
        .from("dm_threads")
        .select("session_a, session_b")
        .eq("id", body.target_id)
        .maybeSingle();
      if (!thread) {
        return Response.json({ error: "Thread not found" }, { status: 404 });
      }
      if (
        thread.session_a !== sessionId &&
        thread.session_b !== sessionId
      ) {
        return Response.json(
          { error: "You can't report a conversation you're not in." },
          { status: 403 }
        );
      }
    } else if (body.target_type === "dm_message") {
      const { data: dm } = await db
        .from("dm_messages")
        .select("sender_id, thread_id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (!dm) {
        return Response.json({ error: "Message not found" }, { status: 404 });
      }
      if (dm.sender_id === sessionId) {
        return Response.json(
          { error: "You can't report your own message." },
          { status: 400 }
        );
      }
      const { data: thread } = await db
        .from("dm_threads")
        .select("session_a, session_b")
        .eq("id", dm.thread_id)
        .maybeSingle();
      if (
        !thread ||
        (thread.session_a !== sessionId && thread.session_b !== sessionId)
      ) {
        return Response.json(
          { error: "You can't report a message you're not part of." },
          { status: 403 }
        );
      }
    } else if (body.target_type === "user") {
      const { data: user } = await db
        .from("sessions")
        .select("id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      if (user.id === sessionId) {
        return Response.json(
          { error: "You can't report yourself." },
          { status: 400 }
        );
      }
    } else if (body.target_type === "broadcast") {
      const { data: bcast } = await db
        .from("broadcasts")
        .select("session_id")
        .eq("id", body.target_id)
        .maybeSingle();
      if (!bcast) {
        return Response.json({ error: "Broadcast not found" }, { status: 404 });
      }
      if (bcast.session_id === sessionId) {
        return Response.json(
          { error: "You can't report your own broadcast." },
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

    // ── Auto-hide check ──
    // Count distinct reporters (unique constraint makes row count =
    // distinct). Threshold logic lives in AUTO_HIDE_FLAG_THRESHOLD.
    const { count } = await db
      .from("content_flags")
      .select("id", { count: "exact", head: true })
      .eq("target_type", body.target_type)
      .eq("target_id", body.target_id)
      .eq("status", "open");

    let autoHidden = false;
    if ((count ?? 0) >= AUTO_HIDE_FLAG_THRESHOLD) {
      autoHidden = await applyAutoHide(db, body.target_type, body.target_id);
    }

    return Response.json({ ok: true, auto_hidden: autoHidden });
  } catch (e) {
    console.error("[flag]", e);
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}