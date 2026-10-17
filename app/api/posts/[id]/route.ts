export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { deleteReportEvidence } from "@/lib/evidence-cleanup";

export async function DELETE(req: NextRequest,
  context: { params: Promise<{ id: string }> }) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

    const params = await context.params;
  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

  const db = createServiceClient();

  // Only allow deleting own posts
  const { data: post } = await db
    .from("reports")
    .select("session_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!post) return Response.json({ error: "not found" }, { status: 404 });
  if (post.session_id !== sessionId) {
    return Response.json({ error: "not your post" }, { status: 403 });
  }

  // Audit finding 4b: nulling evidence_url without deleting the storage
  // object left orphaned files public at their URLs. Delete the file
  // FIRST, before nulling the reference.
  await deleteReportEvidence(params.id);

  // Soft-delete: replace body with redaction note, mark as deleted
  await db
    .from("reports")
    .update({
      body: "[This post has been deleted by the author.]",
      summary_pidgin: null,
      summary_english: null,
      evidence_url: null,
      evidence_link: null,
      evidence_type: "deleted",
      evidence_label: null,
      status: "disputed",
      reviewed: true,
      reviewer_note: "Deleted by author on " + new Date().toISOString()
    })
    .eq("id", params.id);

  return Response.json({ ok: true });
}