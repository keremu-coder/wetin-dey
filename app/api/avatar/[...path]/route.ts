export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import {
  canSeePhoto,
  PHOTO_PENDING_AUTO_APPROVE_MS
} from "@/lib/photo-visibility";
import { imageContentType } from "@/lib/media-url";

/**
 * GET /api/avatar/{ownerId}/{file}
 *
 * Streams the owner's CURRENT avatar after a privacy check. The bytes are
 * returned from this same origin (no redirect to a signed Supabase URL):
 * that removes dependence on CSP img-src, WKWebView app-bound-domain
 * rules, signed-URL expiry and redirect caching, which were all ways a
 * correct row could still render as a broken image.
 *
 * Pre-moderation quarantine (App Review 1.2): a newly uploaded avatar is
 * served only to its owner during the first PHOTO_PENDING_AUTO_APPROVE_MS
 * window. After that, the next read lazily flips the row to 'approved'.
 * Rejected photos return 404 forever.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const nf = (why: string) => {
    console.warn("[avatar] 404:", why);
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" }
    });
  };

  if (path.length !== 2) return nf("bad path");
  const [ownerId, file] = path;

  if (!/^[\w-]{8,64}$/.test(ownerId)) return nf("bad owner id");
  if (!/^[\w-]{1,80}\.(jpg|jpeg|png|webp|heic|gif)$/i.test(file)) return nf("bad file");

  const viewer = await getSessionId();
  const db = createServiceClient();

  const { data: owner, error } = await db
    .from("sessions")
    .select(
      "id, photo_visibility, avatar_url, avatar_review_status, avatar_submitted_at"
    )
    .eq("id", ownerId)
    .maybeSingle();

  if (error) return nf(`db error: ${error.message}`);
  if (!owner || !owner.avatar_url) return nf("no owner/avatar_url");

  // Only serve the current avatar. Strip query/hash so a cache-buster
  // cannot break the match.
  const stored = owner.avatar_url.split(/[?#]/, 1)[0].split("/").pop();
  if (stored !== file) return nf("not current avatar");

  let isFollowing = false;
  if (viewer && viewer !== ownerId) {
    const { data: follow } = await db
      .from("follows")
      .select("follower_session_id")
      .eq("follower_session_id", viewer)
      .eq("followed_session_id", ownerId)
      .maybeSingle();
    isFollowing = !!follow;
  }

  const canSee = canSeePhoto({
    viewerId: viewer,
    targetId: ownerId,
    visibility: owner.photo_visibility,
    isFollowing
  });
  if (!canSee) return nf("viewer not allowed");

  // Review gate.
  const reviewStatus =
    (owner as { avatar_review_status?: string | null }).avatar_review_status ??
    "approved";
  const submittedAt =
    (owner as { avatar_submitted_at?: string | null }).avatar_submitted_at;

  if (reviewStatus === "rejected") return nf("rejected by moderator");

  if (reviewStatus === "pending") {
    const ageMs = submittedAt
      ? Date.now() - new Date(submittedAt).getTime()
      : Number.POSITIVE_INFINITY;
    const isOwner = viewer === ownerId;
    if (ageMs >= PHOTO_PENDING_AUTO_APPROVE_MS) {
      // Lazily flip to approved. Concurrent requests may all hit this;
      // the UPDATE is idempotent.
      await db
        .from("sessions")
        .update({ avatar_review_status: "approved", avatar_submitted_at: null })
        .eq("id", ownerId);
    } else if (!isOwner) {
      return nf("pending review");
    }
  }

  const { data: blob, error: dlErr } = await db.storage
    .from("user-avatars")
    .download(`${ownerId}/${file}`);

  if (dlErr || !blob) return nf(`storage download failed: ${dlErr?.message ?? "empty"}`);

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": imageContentType(file),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
      Vary: "Cookie"
    }
  });
}