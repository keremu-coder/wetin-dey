export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { waitUntil } from "@vercel/functions";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeMessage, analyzeModeration, blockReason } from "@/lib/dm-filter";
import { DM_BODY_MAX } from "@/lib/dm";
import { notifyDMRecipient } from "@/lib/push-server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "@/lib/terms-guard";
import { serverError } from "@/lib/http";

const MEDIA_PATH_RE = /^[\w-]+\/[\w-]+\.(jpg|jpeg|png|webp|heic|mp4|mov|webm)$/i;
const VIDEO_EXTS = new Set(["mp4", "mov", "webm"]);
const MAX_PHOTO = 5 * 1024 * 1024;
const MAX_VIDEO = 15 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    if (await isBanned(sessionId)) {
      return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
    }

    if (!(await hasAcceptedTerms(sessionId))) {
      return Response.json(
        { error: TERMS_NOT_ACCEPTED_MESSAGE, code: TERMS_NOT_ACCEPTED_CODE },
        { status: 403 }
      );
    }

    const limit = await checkRateLimit(
      sessionId,
      { key: "dm_message", limit: 30, windowMs: 60 * 1000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many messages." }, { status: 429 });
    }

    const me = await getOrCreateSessionProfile(sessionId);
    if (!me) {
      return Response.json({ error: "no profile" }, { status: 500 });
    }

    const db = createServiceClient();

    const { data: thread } = await db
      .from("dm_threads")
      .select("id, session_a, session_b")
      .eq("id", params.id)
      .maybeSingle();

    if (!thread) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (thread.session_a !== sessionId && thread.session_b !== sessionId) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const recipientId =
      thread.session_a === sessionId ? thread.session_b : thread.session_a;

    const [blockedByMe, blockedByThem] = await Promise.all([
      db.from("blocked_users").select("id")
        .eq("blocker_session_id", sessionId)
        .eq("blocked_session_id", recipientId)
        .maybeSingle(),
      db.from("blocked_users").select("id")
        .eq("blocker_session_id", recipientId)
        .eq("blocked_session_id", sessionId)
        .maybeSingle()
    ]);

    if (blockedByMe.data || blockedByThem.data) {
      return Response.json(
        { error: "You can't send messages in this conversation." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      body?: unknown;
      media_path?: unknown;
      media_type?: unknown;
      media_mime?: unknown;
      media_size?: unknown;
    };

    const isMedia = !!body.media_path;
    const text = typeof body.body === "string" ? body.body.trim() : "";

    if (!isMedia && text.length < 1) {
      return Response.json({ error: "Empty message" }, { status: 400 });
    }
    if (text.length > DM_BODY_MAX) {
      return Response.json(
        { error: `Max ${DM_BODY_MAX} characters.` },
        { status: 400 }
      );
    }

    const analysis = isMedia
      ? { level: "pass", matches: [] }
      : analyzeMessage(text);

    if (analysis.level === "block") {
      const reason =
        blockReason(analysis as any) ??
        "This message contains contact info and can't be sent.";

      try {
        await db.from("dm_violations").insert({
          id: nanoid(),
          session_id: sessionId,
          thread_id: thread.id,
          kind: analysis.matches?.[0]?.kind ?? "unknown",
          excerpt: text.slice(0, 200)
        });
      } catch { /* non-fatal */ }

      return Response.json(
        { ok: false, blocked: true, reason },
        { status: 400 }
      );
    }

    const mod = isMedia ? { hold: false, matches: [] } : analyzeModeration(text);
    const held = mod.hold;

    if (held) {
      try {
        await db.from("dm_violations").insert({
          id: nanoid(),
          session_id: sessionId,
          thread_id: thread.id,
          kind: mod.matches?.[0]?.kind ?? "moderation",
          excerpt: text.slice(0, 200)
        });
      } catch { /* non-fatal */ }
    }

    // Verify uploaded media: path must be inside this thread, and we must
    // trust the stored object's metadata — not the client-supplied values.
    let verifiedMediaType: string | undefined;
    let verifiedMediaSize: number | undefined;
    let verifiedMediaMime: string | undefined;
    let verifiedMediaPath: string | undefined;

    if (isMedia && typeof body.media_path === "string") {
      const mediaPath = body.media_path;

      if (
        !MEDIA_PATH_RE.test(mediaPath) ||
        !mediaPath.startsWith(`${thread.id}/`)
      ) {
        return Response.json({ error: "Invalid media path." }, { status: 400 });
      }

      const parts = mediaPath.split("/");
      const folder = parts.slice(0, -1).join("/");
      const fileName = parts[parts.length - 1];

      const { data: fileList, error: listErr } = await db.storage
        .from("dm-media")
        .list(folder, { search: fileName });

      if (listErr || !fileList || fileList.length === 0) {
        return Response.json({ error: "Uploaded file not found." }, { status: 400 });
      }

      const meta = fileList[0]?.metadata as
        | { size?: number; mimetype?: string }
        | undefined;

      const actualSize = meta?.size ?? 0;
      const actualMime = meta?.mimetype ?? "";
      const ext = fileName.split(".").pop()!.toLowerCase();
      const isVideo = VIDEO_EXTS.has(ext);
      const maxSize = isVideo ? MAX_VIDEO : MAX_PHOTO;

      if (actualSize === 0) {
        await db.storage.from("dm-media").remove([mediaPath]).catch(() => {});
        return Response.json({ error: "Invalid media file." }, { status: 400 });
      }

      if (actualSize > maxSize) {
        await db.storage.from("dm-media").remove([mediaPath]).catch(() => {});
        return Response.json({ error: "File too large." }, { status: 400 });
      }

      verifiedMediaPath = mediaPath;
      verifiedMediaType = isVideo ? "video" : "photo";
      verifiedMediaSize = actualSize;
      verifiedMediaMime =
        actualMime || (typeof body.media_mime === "string" ? body.media_mime : "");
    }

    const id = nanoid();
    const { data, error } = await db
      .from("dm_messages")
      .insert({
        id,
        thread_id: thread.id,
        sender_id: sessionId,
        body: isMedia ? "" : text,
        filter_level: analysis.level,
        held,
        ...(verifiedMediaPath && {
          media_path: verifiedMediaPath,
          media_type: verifiedMediaType,
          media_mime: verifiedMediaMime,
          media_size: verifiedMediaSize
        })
      })
      .select("id, sender_id, body, created_at, held, filter_level, read_at, media_path, media_type, viewed_at")
      .single();

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    await db
      .from("dm_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", thread.id);

    if (!held) {
      waitUntil(
        notifyDMRecipient({
          recipientSessionId: recipientId,
          senderHandle: me.handle,
          threadId: thread.id,
          body: isMedia ? "📷 Photo" : text
        }).catch((err) => {
          console.error("[dm push]", err);
        })
      );
    }

    return Response.json({ ok: true, message: data });
  } catch (e) {
    return serverError("dm/threads/[id]/messages", e);
  }
}
