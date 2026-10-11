export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { jsonError } from "@/lib/http";
import { sameOrigin } from "@/lib/rate-limit";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertNotBanned } from "@/lib/guards";

/**
 * Legacy per-report flag endpoint. Writes to the older `flags` table,
 * which is read by /admin. The newer /api/flag writes to content_flags,
 * which is read by /admin/pending. Consolidation is a separate task.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!sameOrigin(req)) return jsonError("origin blocked", 403);

    const sessionId = await getSessionId();
    if (!sessionId) return jsonError("no session", 401);

    const denied = await assertNotBanned(sessionId);
    if (denied) return denied;

    const limit = await checkRateLimit(sessionId, {
      key: "report_flag",
      limit: 20,
      windowMs: 60 * 60 * 1000
    });
    if (!limit.ok) {
      return jsonError("Too many reports. Try again later.", 429);
    }

    const payload = (await req.json()) as { reason?: unknown };
    const reason = String(payload.reason ?? "").trim();
    if (reason.length < 3 || reason.length > 500) {
      return jsonError("reason no correct", 400);
    }

    const db = createServiceClient();
    const { data: report } = await db
      .from("reports")
      .select("id, session_id")
      .eq("id", params.id)
      .maybeSingle();

    if (!report) return jsonError("no dey", 404);

    // Self-flag guard: you can't flag your own report.
    if (report.session_id === sessionId) {
      return jsonError("You can't report your own report.", 400);
    }

    const { error } = await db.from("flags").insert({
      id: nanoid(),
      report_id: params.id,
      reason,
      session_id: sessionId,
      resolved: false
    });

    if (error) {
      // Duplicate flag (unique constraint) is a soft success — the
      // moderator already has a flag from this user on this report.
      if (String(error.message).toLowerCase().includes("duplicate")) {
        return Response.json({ ok: true, duplicate: true });
      }
      return jsonError("flag no save", 500);
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[report flag]", e);
    return jsonError("Server error: " + (e as Error).message, 500);
  }
}