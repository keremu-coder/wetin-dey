export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { canSeePhoto } from "@/lib/photo-visibility";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const nf = () => new NextResponse("Not found", { status: 404 });

  // Expected: /api/avatar/{ownerSessionId}/{filename}.{ext}
  if (path.length !== 2) return nf();
  const [ownerId, file] = path;

  // Sanitize both segments
  if (!/^[\w-]{8,64}$/.test(ownerId)) return nf();
  if (!/^[\w-]{1,80}\.(jpg|jpeg|png|webp|heic|gif)$/i.test(file)) return nf();

  const viewer = await getSessionId();
  const db = createServiceClient();

  const { data: owner } = await db
    .from("sessions")
    .select("id, photo_visibility, avatar_url")
    .eq("id", ownerId)
    .maybeSingle();

  if (!owner || !owner.avatar_url) return nf();

  // Only serve the current avatar — prevents fetching stale avatars after a swap
  const stored = owner.avatar_url.split("/").pop();
  if (stored !== file) return nf();

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
  if (!canSee) return nf();

  const { data: signed } = await db.storage
    .from("user-avatars")
    .createSignedUrl(`${ownerId}/${file}`, 60);

  if (!signed) return nf();

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=30" }
  });
}
