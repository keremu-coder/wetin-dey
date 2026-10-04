export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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