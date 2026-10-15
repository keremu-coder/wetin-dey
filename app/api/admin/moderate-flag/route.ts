export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { serverError } from "@/lib/http";
import { deleteReportFromTelegram } from "@/lib/telegram";

type Action = "dismiss" | "remove" | "ban_user";
const VALID_ACTIONS: Action[] = ["dismiss", "remove", "ban_user"];

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
    const { data: row, error } = await db
      .from("reports")
      .update({ held: true })
      .eq("id", targetId)
      .select("telegram_message_id")
      .maybeSingle();
    // Takedown must also remove the public Telegram copy (same as the
    // admin "hide" action), or the 24-hour promise does not hold.
    const mid = (row as { telegram_message_id?: number | null } | null)
      ?.telegram_message_id;
    if (!error && mid) {
      try {
        await deleteReportFromTelegram(mid);
      } catch {
        /* best-effort */
      }
    }
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
  return false;
}

/**
 * Mirror of hideTarget. Only called by the dismiss action, and only
 * when no other "actioned" flag is still attached to the same target
 * (otherwise we'd unhide content a moderator explicitly removed).
 */
async function unhideTarget(
  db: ReturnType<typeof createServiceClient>,
  targetType: string,
  targetId: string
): Promise<boolean> {
  if (targetType === "message") {
    const { error } = await db
      .from("community_messages")
      .update({ hidden: false })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "comment") {
    const { error } = await db
      .from("comments")
      .update({ hidden: false })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "post" || targetType === "report") {
    const { error } = await db
      .from("reports")
      .update({ held: false })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "dm_message") {
    const { error } = await db
      .from("dm_messages")
      .update({ held: false })
      .eq("id", targetId);
    return !error;
  }
  if (targetType === "broadcast") {
    const { error } = await db
      .from("broadcasts")
      .update({ hidden: false })
      .eq("id", targetId);
    return !error;
  }
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
      return Response.json({ error: "Server error" }, { status: 500 });
    }
    if (!flag) {
      return Response.json({ error: "flag not found" }, { status: 404 });
    }

    const newStatus = action === "dismiss" ? "dismissed" : "actioned";

    if (action === "dismiss") {
      // Before we dismiss, check whether any OTHER flag on the same
      // target is still "actioned". If yes, the content should stay
      // hidden — a moderator explicitly removed it for another reason.
      // Only if this is the last remaining flag do we restore visibility.
      const { count: otherActioned } = await db
        .from("content_flags")
        .select("id", { count: "exact", head: true })
        .eq("target_type", flag.target_type)
        .eq("target_id", flag.target_id)
        .eq("status", "actioned")
        .neq("id", flag.id);

      let restored = false;
      if ((otherActioned ?? 0) === 0) {
        restored = await unhideTarget(
          db,
          flag.target_type,
          flag.target_id
        );
      }

      const { error } = await db
        .from("content_flags")
        .update({ status: newStatus })
        .eq("id", flag.id);
      if (error) {
        return Response.json({ error: "Server error" }, { status: 500 });
      }

      return Response.json({
        ok: true,
        action,
        status: newStatus,
        restored
      });
    }

    if (action === "remove") {
      const hid = await hideTarget(db, flag.target_type, flag.target_id);
      const { error } = await db
        .from("content_flags")
        .update({ status: newStatus })
        .eq("id", flag.id);
      if (error) {
        return Response.json({ error: "Server error" }, { status: 500 });
      }
      if (!hid) {
        console.warn(
          "[moderate-flag] no hide mechanism for",
          flag.target_type
        );
      }
      return Response.json({ ok: true, action, status: newStatus, hidden: hid });
    }

    if (action === "ban_user") {
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
        return Response.json({ error: "Server error" }, { status: 500 });
      }

      // Also ban the session's last-seen IP hash for 30 days. This
      // does not stop evasion from a different network, but it blocks
      // the common "clear cookies, retry from same WiFi" case.
      try {
        const { data: bannedRow } = await db
          .from("sessions")
          .select("last_ip_hash")
          .eq("id", authorId)
          .maybeSingle();
        const ipHash = (bannedRow as { last_ip_hash?: string | null } | null)
          ?.last_ip_hash;
        if (ipHash) {
          const expiresAt = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString();
          await db.from("banned_ip_hashes").upsert({
            ip_hash: ipHash,
            banned_at: new Date().toISOString(),
            expires_at: expiresAt,
            reason: note ?? "Repeated guideline violations"
          });
        }
      } catch (e) {
        console.error("[moderate-flag] IP ban record failed:", e);
      }

      await hideTarget(db, flag.target_type, flag.target_id);

      const { error } = await db
        .from("content_flags")
        .update({ status: newStatus })
        .eq("id", flag.id);
      if (error) {
        return Response.json({ error: "Server error" }, { status: 500 });
      }

      return Response.json({ ok: true, action, status: newStatus });
    }

    return Response.json({ error: "unreachable" }, { status: 500 });
  } catch (e) {
    console.error("[moderate-flag]", e);
    return serverError("admin/moderate-flag", e);
  }
}