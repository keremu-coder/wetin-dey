export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

function extractPath(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/storage/v1/object/public/user-avatars/";
    const i = u.pathname.indexOf(marker);
    if (i >= 0) return u.pathname.slice(i + marker.length);
  } catch {
    /* ignore */
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "multipart required" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("avatar");

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No image" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: "Image too large (max 2MB)" },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return Response.json(
        { error: "Only JPG, PNG, or WebP" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let processed: Buffer;
    try {
      processed = await sharp(buf)
        .rotate()
        .resize(400, 400, { fit: "cover", position: "attention" })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      return Response.json({ error: "Could not read image" }, { status: 400 });
    }

    const db = createServiceClient();

    const { data: existing } = await db
      .from("sessions")
      .select("avatar_url")
      .eq("id", sessionId)
      .maybeSingle();

    if (existing?.avatar_url) {
      const oldPath = extractPath(existing.avatar_url);
      if (oldPath) {
        await db.storage
          .from("user-avatars")
          .remove([oldPath])
          .catch(() => {});
      }
    }

    const path = `${sessionId}/${nanoid()}.jpg`;
    const up = await db.storage.from("user-avatars").upload(path, processed, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "31536000"
    });
    if (up.error) {
      return Response.json(
        { error: "Upload failed: " + up.error.message },
        { status: 500 }
      );
    }

    const url = db.storage.from("user-avatars").getPublicUrl(path).data
      .publicUrl;

    const { error } = await db
      .from("sessions")
      .update({ avatar_url: url })
      .eq("id", sessionId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, avatar_url: url });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const db = createServiceClient();
    const { data: existing } = await db
      .from("sessions")
      .select("avatar_url")
      .eq("id", sessionId)
      .maybeSingle();

    if (existing?.avatar_url) {
      const oldPath = extractPath(existing.avatar_url);
      if (oldPath) {
        await db.storage
          .from("user-avatars")
          .remove([oldPath])
          .catch(() => {});
      }
    }

    await db
      .from("sessions")
      .update({ avatar_url: null })
      .eq("id", sessionId);

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}