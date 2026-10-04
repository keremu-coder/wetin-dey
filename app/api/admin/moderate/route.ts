import { nanoid } from "nanoid";
import { originAllowed, jsonError } from "@/lib/http";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

async function requireAdmin(sessionId: string | null) {
  if (!sessionId) return false;
  const db = createServiceClient();
  const { data } = await db.from("admins").select("session_id").eq("session_id", sessionId).maybeSingle();
  return Boolean(data);
}

export async function POST(req: Request) {
  if (!originAllowed(req)) return jsonError("origin blocked", 403);
  const sessionId = await getSessionId();
  if (!(await requireAdmin(sessionId))) return jsonError("no dey", 404);

  const payload = (await req.json()) as {
    report_id?: string;
    comment_id?: string;
    action?: string;
    note?: string;
  };
  const action = String(payload.action ?? "");
  const reportId = String(payload.report_id ?? "");
  const commentId = payload.comment_id ? String(payload.comment_id) : null;
  const note = payload.note ? String(payload.note).slice(0, 1000) : null;

  if (!["approve", "disputed", "hide"].includes(action)) {
    return jsonError("action no correct", 400);
  }

  const db = createServiceClient();

  if (action === "approve") {
    if (!reportId) return jsonError("report missing", 400);
    await db.from("reports").update({ reviewed: true, reviewer_note: note }).eq("id", reportId);
  } else if (action === "disputed") {
    if (!reportId) return jsonError("report missing", 400);
    await db
      .from("reports")
      .update({ status: "disputed", reviewer_note: note })
      .eq("id", reportId);
  } else if (action === "hide") {
    if (commentId) {
      await db.from("comments").update({ hidden: true }).eq("id", commentId);
    } else if (reportId) {
      await db.from("reports").update({ reviewed: false, reviewer_note: note }).eq("id", reportId);
    } else {
      return jsonError("nothing to hide", 400);
    }
  }

  await db.from("moderation_actions").insert({
    id: nanoid(),
    report_id: reportId || null,
    action,
    moderator_note: note
  });

  return Response.json({ ok: true });
}
