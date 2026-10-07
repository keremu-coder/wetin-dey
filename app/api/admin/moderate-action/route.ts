export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();

    const { data: admin } = await db
      .from("admins")
      .select("session_id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!admin) {
      return Response.json({ error: "not admin" }, { status: 403 });
    }

    const body = (await req.json()) as {
      kind?: unknown;
      target_id?: unknown;
      action?: unknown;
      reason?: unknown;
    };

    if (body.kind !== "report" && body.kind !== "reply") {
      return Response.json({ error: "bad kind" }, { status: 400 });
    }
    if (typeof body.target_id !== "string" || !body.target_id) {
      return Response.json({ error: "bad target_id" }, { status: 400 });
    }
    if (body.action !== "approve" && body.action !== "reject") {
      return Response.json({ error: "bad action" }, { status: 400 });
    }

    if (body.kind === "report") {
      if (body.action === "approve") {
        const { error } = await db
          .from("reports")
          .update({ held: false, reviewed: true })
          .eq("id", body.target_id);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      } else {
        // Rejection: keep held, but note the reason
        const reason =
          typeof body.reason === "string" && body.reason.trim()
            ? body.reason.trim().slice(0, 300)
            : "Rejected by moderator";
        const { error } = await db
          .from("reports")
          .update({
            reviewer_note: reason,
            reviewed: false
          })
          .eq("id", body.target_id);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      }
    } else {
      // reply
      if (body.action === "approve") {
        const { error } = await db
          .from("report_replies")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: sessionId
          })
          .eq("id", body.target_id);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      } else {
        const reason =
          typeof body.reason === "string" && body.reason.trim()
            ? body.reason.trim().slice(0, 300)
            : "Rejected by moderator";
        const { error } = await db
          .from("report_replies")
          .update({
            status: "rejected",
            rejection_reason: reason
          })
          .eq("id", body.target_id);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}