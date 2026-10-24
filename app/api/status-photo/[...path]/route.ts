export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import {
  extractStatusPhotoFilename,
  isStatusPhotoActive,
  statusPhotoStoragePath
} from "@/lib/status-photo";
import { imageContentType } from "@/lib/media-url";
import { PHOTO_PENDING_AUTO_APPROVE_MS, canSeePhoto } from "@/lib/photo-visibility";

/**
 * GET /api/status-photo/{ownerId}/{file}
 *
 * Streams a story image to a signed-in viewer. Only the owner's current,
 * unexpired (24h) photo is served. Blocks in either direction are
 * respected. Bytes are served from this origin (no redirect) so the story
 * loads inside the iOS/Android WebView regardless of CSP or
 * app-bound-domain settings.
 *
 * Review gate mirrors /api/avatar: pending photos are owner-only during
 * the auto-approve window, then lazily approved on the next read.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const notFound = (why: string) => {
    console.warn("[status-photo] 404:", why);
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" }
    });
  };

  if (path.length !== 2) return notFound("bad path");
  const [ownerId, filename] = path;
  if (
    !/^[\w-]{8,64}$/.test(ownerId) ||
    !/^[\w-]{1,80}\.(jpg|jpeg|png|webp)$/i.test(filename)
  ) {
    return notFound("bad segments");
  }

  const viewerId = await getSessionId();
  if (!viewerId) return notFound("no viewer session");

  const db = createServiceClient();
  const { data: owner, error } = await db
    .from("sessions")
    .select(
      "status_photo_url, status_photo_updated_at, status_photo_review_status, status_photo_submitted_at, photo_visibility"
    )
    .eq("id", ownerId)
    .maybeSingle();

  if (error) return notFound(`db error: ${error.message}`);
  if (!owner) return notFound("owner not found");
  if (!isStatusPhotoActive(owner.status_photo_updated_at)) {
    return notFound("expired or no status");
  }

  const currentFilename = extractStatusPhotoFilename(owner.status_photo_url, ownerId);
  if (currentFilename !== filename) return notFound("not current status photo");

  // Respect owner's photo privacy setting
  if (viewerId !== ownerId && !canSeePhoto(owner.photo_visibility)) {
    return notFound("private visibility");
  }

  // Blocks in both directions (owner can always see their own).
  if (viewerId !== ownerId) {
    const { data: blocks } = await db
      .from("blocked_users")
      .select("blocker_session_id, blocked_session_id")
      .or(
        `and(blocker_session_id.eq.${viewerId},blocked_session_id.eq.${ownerId}),and(blocker_session_id.eq.${ownerId},blocked_session_id.eq.${viewerId})`
      )
      .limit(1);
    if (blocks && blocks.length > 0) return notFound("blocked");
  }

  // Review gate.
  const reviewStatus =
    (owner as { status_photo_review_status?: string | null })
      .status_photo_review_status ?? "approved";
  const submittedAt =
    (owner as { status_photo_submitted_at?: string | null })
      .status_photo_submitted_at;

  if (reviewStatus === "rejected") return notFound("rejected by moderator");

  if (reviewStatus === "pending") {
    const ageMs = submittedAt
      ? Date.now() - new Date(submittedAt).getTime()
      : Number.POSITIVE_INFINITY;
    const isOwner = viewerId === ownerId;
    if (ageMs >= PHOTO_PENDING_AUTO_APPROVE_MS) {
      await db
        .from("sessions")
        .update({
          status_photo_review_status: "approved",
          status_photo_submitted_at: null
        })
        .eq("id", ownerId);
    } else if (!isOwner) {
      return notFound("pending review");
    }
  }

  const { data: blob, error: dlErr } = await db.storage
    .from("user-avatars")
    .download(statusPhotoStoragePath(ownerId, filename));

  if (dlErr || !blob) {
    return notFound(`storage download failed: ${dlErr?.message ?? "empty"}`);
  }

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": imageContentType(filename),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
      "Referrer-Policy": "no-referrer",
      Vary: "Cookie"
    }
  });
}