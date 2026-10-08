export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

type Action = "dismiss" | "remove" | "ban_user";
const VALID_ACTIONS: Action[] = ["dismiss", "remove", "ban_user"];

/**
 * Look up the author's session_id for a given flag target.
 * Returns null if we can't determine it (some target types have no
 * single author, e.g. dm_thread which has two participants).
 */
async function resolveTargetAuthor(
  db: ReturnType<typeof createServiceClient>,
  targetType: string,
  targetId: string
): Promise<string | null> {
  if (targetType === "message") {
    const { data } = await db
      .from("community_messages")
      .select("session_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.session_id ?? null;
  }
  if (targetType === "comment") {
    const { data } = await db
      .from("comments")
      .select("session_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.session_id ?? null;
  }
  if (targetType === "post" || targetType === "report") {
    const { data } = await db
      .from("reports")
      .select("session_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.session_id ?? null;
  }
  if (targetType === "dm_message") {
    const { data } = await db
      .from("dm_messages")
      .select("sender_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.sender_id ?? null;
  }
  if (targetType === "broadcast") {
    const { data } = await db
      .from("broadcasts")
      .select("session_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.session_id ?? null;
  }
  if (targetType === "user") {
    return targetId;
  }
  if (targetType === "community") {
    const { data } = await db
      .from("communities")
      .select("owner_session_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.owner_session_id ?? null;
  }
  // dm_thread has two participants — no single author to act on.
  return null;
}

async function hideTarget(
  db: ReturnType<typeof createServiceClient>,
  targetType: string,
  targetId: string
): Promise<boolean> {
  if (targetType === "message") {
    const { error } = await db
      .from("community_messages")
      .update({ hidden: true })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "comment") {
    const { error } = await db
      .from("comments")
      .update({ hidden: true })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "post" || targetType === "report") {
    const { error } = await db
      .from("reports")
      .update({ held: true })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "dm_message") {
    const { error } = await db
      .from("dm_messages")
      .update({ held: true })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "broadcast") {
    const { error } = await db
      .from("broadcasts")
      .update({ hidden: true })
      .eq("id", targetId);
    return !error;
  }
  // user / dm_thread / community — no per-row hide
  return false;
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const adminSessionId = await getSessionId();
    if (!adminSessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();

    const { data: admin } = await db
      .from("admins")
      .select("session_id")
      .eq("session_id", adminSessionId)
      .maybeSingle();

    if (!admin) {
      return Response.json({ error: "not admin" }, { status: 403 });
    }

    const body = (await req.json()) as {
      flag_id?: unknown;
      action?: unknown;
      reason?: unknown;
    };

    if (typeof body.flag_id !== "string" || !body.flag_id) {
      return Response.json({ error: "flag_id required" }, { status: 400 });
    }
    if (
      typeof body.action !== "string" ||
      !VALID_ACTIONS.includes(body.action as Action)
    ) {
      return Response.json({ error: "invalid action" }, { status: 400 });
    }

    const action = body.action as Action;
    const note =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 300)
        : null;

    const { data: flag, error: flagErr } = await db
      .from("content_flags")
      .select("id, target_type, target_id, status")
      .eq("id", body.flag_id)
      .maybeSingle();

    if (flagErr) {
      return Response.json({ error: flagErr.message }, { status: 500 });
    }
    if (!flag) {
      return Response.json({ error: "flag not found" }, { status: 404 });
    }

    const newStatus =
      action === "dismiss" ? "dismissed" : "actioned";

    if (action === "dismiss") {
      const { error } = await db
        .from("content_flags")
        .update({ status: newStatus })
        .eq("id", flag.id);
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    } else if (action === "remove") {
      const hid = await hideTarget(db, flag.target_type, flag.target_id);
      const { error } = await db
        .from("content_flags")
        .update({ status: newStatus })
        .eq("id", flag.id);
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      if (!hid) {
        // No hide mechanism for this target type — log for audit but say so.
        console.warn(
          "[moderate-flag] no hide mechanism for",
          flag.target_type
        );
      }
    } else if (action === "ban_user") {
      const authorId = await resolveTargetAuthor(
        db,
        flag.target_type,
        flag.target_id
      );

      if (!authorId) {
        return Response.json(
          { error: "Could not determine the author to ban." },
          { status: 400 }
        );
      }
      if (authorId === adminSessionId) {
        return Response.json(
          { error: "You can't ban yourself." },
          { status: 400 }
        );
      }

      const { error: banErr } = await db
        .from("sessions")
        .update({
          banned_at: new Date().toISOString(),
          ban_reason: note ?? "Repeated guideline violations"
        })
        .eq("id", authorId);

      if (banErr) {
        return Response.json({ error: banErr.message }, { status: 500 });
      }

      // Also hide the offending content.
      await hideTarget(db, flag.target_type, flag.target_id);

      const { error } = await db
        .from("content_flags")
        .update({ status: newStatus })
        .eq("id", flag.id);
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    return Response.json({ ok: true, action, status: newStatus });
  } catch (e) {
    console.error("[moderate-flag]", e);
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}