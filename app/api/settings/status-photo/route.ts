export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import { serverError } from "@/lib/http";

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
    if (!limit.ok) return Response.json({ error: "Slow down." }, { status: 429 });

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "multipart required" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("photo");

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No image" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Image too large (max 5MB)" }, { status: 400 });
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return Response.json({ error: "Only JPG, PNG, or WebP" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let processed: Buffer;
    try {
      processed = await sharp(buf, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize(800, 800, { fit: "inside" })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      return Response.json({ error: "Could not read image" }, { status: 400 });
    }

    const db = createServiceClient();
    const uploadPath = `status/${sessionId}/${nanoid()}.jpg`;

    const up = await db.storage.from("user-avatars").upload(uploadPath, processed, {
      contentType: "image/jpeg",
      upsert: false,
    });
    
    if (up.error) return Response.json({ error: "Upload failed" }, { status: 500 });

    const url = db.storage.from("user-avatars").getPublicUrl(uploadPath).data.publicUrl;

    await db.from("sessions").update({
      status_photo_url: url,
      status_photo_updated_at: new Date().toISOString()
    }).eq("id", sessionId);

    return Response.json({ ok: true, status_photo_url: url });
  } catch (e) {
    return serverError("settings/status-photo", e);
  }
}
