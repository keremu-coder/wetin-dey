export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";

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
    const file = form.get("photo") as File | null;
    
    if (!file || file.size === 0) return Response.json({ error: "No image" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Max 5MB" }, { status: 400 });
    if (!file.type.startsWith("image/")) return Response.json({ error: "Must be image" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const processed = await sharp(buf, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize(600, 600, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const db = createServiceClient();
    const path = `status/${sessionId}/${nanoid()}.jpg`;

    const up = await db.storage.from("user-avatars").upload(path, processed, {
      contentType: "image/jpeg",
      upsert: false
    });

    if (up.error) return Response.json({ error: "Upload failed" }, { status: 500 });

    const url = db.storage.from("user-avatars").getPublicUrl(path).data.publicUrl;

    await db.from("sessions").update({
      status_photo_url: url,
      status_photo_updated_at: new Date().toISOString()
    }).eq("id", sessionId);

    return Response.json({ ok: true, url });
  } catch (e) {
    console.error("[status-photo]", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
