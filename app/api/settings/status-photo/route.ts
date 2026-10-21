export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import {
  extractStatusPhotoFilename,
  statusPhotoStoragePath
} from "@/lib/status-photo";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "bad origin" }, { status: 403 });
    const sessionId = await getSessionId();
    if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const limit = await checkRateLimit(
      sessionId,
      { key: "status_photo", limit: 10, windowMs: 3600000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) return Response.json({ error: "Slow down" }, { status: 429 });

    const form = await req.formData();
    const file = form.get("photo");

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No image" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return Response.json({ error: "Max 5MB" }, { status: 400 });
    if (!ALLOWED_MIMES.includes(file.type)) {
      return Response.json({ error: "Only JPG, PNG, or WebP" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let processed: Buffer;
    try {
      processed = await sharp(buf, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize(600, 600, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      return Response.json({ error: "Could not read image" }, { status: 400 });
    }

    const db = createServiceClient();
    const { data: existing } = await db
      .from("sessions")
      .select("status_photo_url")
      .eq("id", sessionId)
      .maybeSingle();

    const previousFilename = extractStatusPhotoFilename(
      existing?.status_photo_url,
      sessionId
    );
    const filename = `${nanoid()}.jpg`;
    const path = statusPhotoStoragePath(sessionId, filename);

    const up = await db.storage.from("user-avatars").upload(path, processed, {
      contentType: "image/jpeg",
      upsert: false
    });

    if (up.error) return Response.json({ error: "Upload failed" }, { status: 500 });

    const url = `/api/status-photo/${sessionId}/${filename}`;

    const { error: updateError } = await db.from("sessions").update({
      status_photo_url: url,
      status_photo_updated_at: new Date().toISOString(),
      status_photo_review_status: "pending",
      status_photo_submitted_at: new Date().toISOString()
    }).eq("id", sessionId);

    if (updateError) {
      await db.storage.from("user-avatars").remove([path]).catch(() => {});
      return Response.json({ error: "Could not save status" }, { status: 500 });
    }

    if (previousFilename && previousFilename !== filename) {
      const oldPath = statusPhotoStoragePath(sessionId, previousFilename);
      const { error: removeError } = await db.storage
        .from("user-avatars")
        .remove([oldPath]);
      if (removeError) {
        console.error("[status-photo] old image cleanup failed:", removeError.message);
      }
    }

    return Response.json({ ok: true, url });
  } catch (e) {
    console.error("[status-photo]", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE — remove my current status photo immediately.
 * Gives users control over their own story (App Review 1.2 / 5.1.1) and
 * frees the storage object instead of waiting for replacement/expiry.
 */
export async function DELETE(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "bad origin" }, { status: 403 });
    const sessionId = await getSessionId();
    if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

    const limit = await checkRateLimit(
      sessionId,
      { key: "status_photo_delete", limit: 20, windowMs: 3600000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) return Response.json({ error: "Slow down" }, { status: 429 });

    const db = createServiceClient();
    const { data: existing } = await db
      .from("sessions")
      .select("status_photo_url")
      .eq("id", sessionId)
      .maybeSingle();

    const filename = extractStatusPhotoFilename(existing?.status_photo_url, sessionId);

    const { error: updateError } = await db
      .from("sessions")
      .update({ status_photo_url: null, status_photo_updated_at: null })
      .eq("id", sessionId);
    if (updateError) return Response.json({ error: "Could not remove status" }, { status: 500 });

    if (filename) {
      const { error: rmErr } = await db.storage
        .from("user-avatars")
        .remove([statusPhotoStoragePath(sessionId, filename)]);
      if (rmErr) console.error("[status-photo] delete cleanup failed:", rmErr.message);
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[status-photo:delete]", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}