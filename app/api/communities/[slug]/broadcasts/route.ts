export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToSessions } from "@/lib/push-server";
import {
  BROADCAST_MAX_MB,
  BROADCAST_TITLE_MAX
} from "@/lib/broadcasts";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
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

    const nowIso = new Date().toISOString();
    const { data: broadcasts } = await db
      .from("broadcasts")
      .select("id, session_id, audio_url, duration_seconds, title, created_at, expires_at")
      .eq("community_id", community.id)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch author handles
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
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

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

    // Only owner can broadcast (for now — can add admin role later)
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
      titleRaw.length > 0
        ? titleRaw.slice(0, BROADCAST_TITLE_MAX)
        : null;
    const duration = Number(durationRaw);
    const duration_seconds =
      Number.isFinite(duration) && duration > 0
        ? Math.round(duration)
        : null;

    const audioId = nanoid();
    const path = `broadcasts/${community.id}/${audioId}.webm`;
    const buf = Buffer.from(await file.arrayBuffer());

    const up = await db.storage.from("voice-notes").upload(path, buf, {
      contentType: file.type || "audio/webm",
      upsert: false
    });
    if (up.error) {
      return Response.json(
        { error: "Upload: " + up.error.message },
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
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Push to every member except the sender. Don't block the response —
    // the sender's phone should not wait for FCM.
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
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}