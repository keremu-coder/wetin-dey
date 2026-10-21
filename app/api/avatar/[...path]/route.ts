export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { canSeePhoto } from "@/lib/photo-visibility";
import { imageContentType } from "@/lib/media-url";

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
    .select("id, photo_visibility, avatar_url")
    .eq("id", ownerId)
    .maybeSingle();

  if (error) return nf(`db error: ${error.message}`);
  if (!owner || !owner.avatar_url) return nf("no owner/avatar_url");

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