export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToSessions } from "@/lib/push-server";
import { BROADCAST_MAX_MB, BROADCAST_TITLE_MAX } from "@/lib/broadcasts";
import { assertCanWrite } from "@/lib/guards";
import { getBlockedIds } from "@/lib/blocks";
import { serverError } from "@/lib/http";
import { sameOrigin } from "@/lib/rate-limit";
import { stripMediaMetadata } from "@/lib/media-strip";
import { audioContainerFor } from "@/lib/audio-container";

function extFromMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  return "webm";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
    const params = await context.params;
  try {
    const db = createServiceClient();

    const { data: community } = await db
      .from("communities")
      .select("id")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const requesterId = await getSessionId();
    const blockedIds = await getBlockedIds(requesterId);
    const blockedList = Array.from(blockedIds);

    const nowIso = new Date().toISOString();
    let q = db
      .from("broadcasts")
      .select(
        "id, session_id, audio_url, duration_seconds, title, created_at, expires_at"
      )
      .eq("community_id", community.id)
      .eq("hidden", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(5);

    if (blockedList.length > 0) {
      q = q.not("session_id", "in", `(${blockedList.join(",")})`);
    }

    const { data: broadcasts } = await q;

    const ids = Array.from(
      new Set((broadcasts ?? []).map((b) => b.session_id))
    );
    const handleMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle")
        .in("id", ids);
      for (const p of profiles ?? []) {
        handleMap.set(p.id, p.handle);
      }
    }

    return Response.json({
      broadcasts: (broadcasts ?? []).map((b) => ({
        ...b,
        author_handle: handleMap.get(b.session_id) ?? "Anonymous"
      }))
    });
  } catch (e) {
    return serverError("communities/[slug]/broadcasts", e);
  }
}

export async function POST(req: NextRequest,
  context: { params: Promise<{ slug: string }> }) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

    const params = await context.params;
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const denied = await assertCanWrite(sessionId);
    if (denied) return denied;

    const profile = await getOrCreateSessionProfile(sessionId);
    if (!profile) {
      return Response.json({ error: "no profile" }, { status: 500 });
    }

    const db = createServiceClient();

    const { data: community } = await db
      .from("communities")
      .select("id, name, slug, owner_session_id")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (community.owner_session_id !== sessionId) {
      return Response.json(
        { error: "Only the space owner can broadcast." },
        { status: 403 }
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "multipart required" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("audio");
    const titleRaw = String(form.get("title") ?? "").trim();
    const durationRaw = form.get("duration_seconds");

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "audio required" }, { status: 400 });
    }
    if (file.size > BROADCAST_MAX_MB * 1024 * 1024) {
      return Response.json(
        { error: `Voice note too large (max ${BROADCAST_MAX_MB}MB)` },
        { status: 400 }
      );
    }

    const title =
      titleRaw.length > 0 ? titleRaw.slice(0, BROADCAST_TITLE_MAX) : null;
    const duration = Number(durationRaw);
    const duration_seconds =
      Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;

    const audioId = nanoid();
    const fileMime = file.type || "audio/webm";
    const ext = extFromMime(fileMime);
    const path = `broadcasts/${community.id}/${audioId}.${ext}`;
    const rawBuf = Buffer.from(await file.arrayBuffer());
    // Strip container metadata (GPS, device, timestamps) before storing.
    // Fail-closed: a strip failure aborts the upload instead of storing raw.
    const buf = await stripMediaMetadata(rawBuf, audioContainerFor(fileMime).ext);

    const up = await db.storage.from("voice-notes").upload(path, buf, {
      contentType: fileMime,
      upsert: false
    });
    if (up.error) {
      return Response.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }
    const audio_url = db.storage.from("voice-notes").getPublicUrl(path).data
      .publicUrl;

    const { data, error } = await db
      .from("broadcasts")
      .insert({
        community_id: community.id,
        session_id: sessionId,
        audio_url,
        duration_seconds,
        title
      })
      .select("*")
      .single();

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    void (async () => {
      try {
        const { data: members } = await db
          .from("community_members")
          .select("session_id")
          .eq("community_id", community.id);

        const recipients = (members ?? [])
          .map((m) => m.session_id)
          .filter((id) => id && id !== sessionId);

        if (recipients.length === 0) return;

        await sendPushToSessions(recipients, {
          title: `📢 Broadcast from ${community.name}`,
          body: title || "New voice broadcast — tap to listen",
          tag: `broadcast-${community.id}`,
          url: `/c/${community.slug}/chat`
        });
      } catch (err) {
        console.error("[broadcast push]", err);
      }
    })();

    return Response.json({
      ok: true,
      broadcast: {
        ...data,
        author_handle: profile.handle
      }
    });
  } catch (e) {
    return serverError("communities/[slug]/broadcasts", e);
  }
}