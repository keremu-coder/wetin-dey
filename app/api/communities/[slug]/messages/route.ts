export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { waitUntil } from "@vercel/functions";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyCommunityMembers } from "@/lib/push-server";

function extFromMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  return "webm";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const db = createServiceClient();

    const { data: community } = await db
      .from("communities")
      .select("id, is_public")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const { data: messages, error } = await db
      .from("community_messages")
      .select("id, session_id, body, audio_url, created_at")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const ordered = (messages ?? []).reverse();

    const sessionIds = Array.from(new Set(ordered.map((m) => m.session_id)));
    const handleMap = new Map<string, string>();
    const lastSeenMap = new Map<string, string | null>();

    if (sessionIds.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle, last_seen_at")
        .in("id", sessionIds);

      for (const p of profiles ?? []) {
        handleMap.set(p.id, p.handle);
        lastSeenMap.set(p.id, p.last_seen_at ?? null);
      }
    }

    const msgIds = ordered.map((m) => m.id);
    const reactionMap = new Map<string, { emoji: string; count: number }[]>();
    if (msgIds.length > 0) {
      const { data: reactions } = await db
        .from("message_reactions")
        .select("message_id, emoji")
        .in("message_id", msgIds);

      for (const r of reactions ?? []) {
        const list = reactionMap.get(r.message_id) ?? [];
        const existing = list.find((x) => x.emoji === r.emoji);
        if (existing) existing.count += 1;
        else list.push({ emoji: r.emoji, count: 1 });
        reactionMap.set(r.message_id, list);
      }
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recent = ordered.filter((m) => m.created_at > fiveMinAgo);
    const onlineHandles = Array.from(
      new Set(recent.map((m) => handleMap.get(m.session_id) ?? "Anonymous"))
    ).slice(0, 8);

    const output = ordered.map((m) => ({
      id: m.id,
      body: m.body,
      audio_url: m.audio_url,
      created_at: m.created_at,
      author_handle: handleMap.get(m.session_id) ?? "Anonymous",
      author_last_seen: lastSeenMap.get(m.session_id) ?? null,
      reactions: reactionMap.get(m.id) ?? []
    }));

    return Response.json({ messages: output, online: onlineHandles });
  } catch (e) {
    console.error("[messages GET]", e);
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
      .select("id, name, slug")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const { data: membership } = await db
      .from("community_members")
      .select("id")
      .eq("community_id", community.id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!membership) {
      return Response.json({ error: "Join the space first." }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let body = "";
    let audio_url: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      body = String(form.get("body") ?? "").trim();
      const file = form.get("audio");

      if (file instanceof File && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return Response.json(
            { error: "Voice note too large (max 5MB)" },
            { status: 400 }
          );
        }
        const audioId = nanoid();
        const fileMime = file.type || "audio/webm";
        const ext = extFromMime(fileMime);
        const path = `chat/${community.id}/${audioId}.${ext}`;
        const buf = Buffer.from(await file.arrayBuffer());
        const up = await db.storage.from("voice-notes").upload(path, buf, {
          contentType: fileMime,
          upsert: false
        });
        if (up.error) {
          return Response.json(
            { error: "Voice upload: " + up.error.message },
            { status: 500 }
          );
        }
        audio_url = db.storage.from("voice-notes").getPublicUrl(path).data
          .publicUrl;
      }
    } else {
      try {
        const json = await req.json();
        body = String(json.body ?? "").trim();
      } catch {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
    }

    if (!body && !audio_url) {
      return Response.json({ error: "Message is empty" }, { status: 400 });
    }
    if (body.length > 500) {
      return Response.json(
        { error: "Message too long (max 500 chars)" },
        { status: 400 }
      );
    }

    const id = nanoid();
    const { data, error } = await db
      .from("community_messages")
      .insert({
        id,
        community_id: community.id,
        session_id: sessionId,
        body: body || null,
        audio_url
      })
      .select("id, body, audio_url, created_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    waitUntil(
      notifyCommunityMembers({
        communityId: community.id,
        senderSessionId: sessionId,
        senderHandle: profile.handle,
        communityName: community.name,
        communitySlug: community.slug,
        body: body || null,
        hasAudio: !!audio_url
      }).catch((err) => {
        console.error("[push notify]", err);
      })
    );

    return Response.json({
      ok: true,
      message: {
        id: data.id,
        body: data.body,
        audio_url: data.audio_url,
        created_at: data.created_at,
        author_handle: profile.handle,
        author_last_seen: new Date().toISOString(),
        reactions: []
      }
    });
  } catch (e) {
    console.error("[messages POST]", e);
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}