export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { waitUntil } from "@vercel/functions";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyCommunityMembers } from "@/lib/push-server";
import { analyzeModeration, moderationReason } from "@/lib/dm-filter";
import { transcribeAndModerate } from "@/lib/voice-moderation";
import { stripMediaMetadata } from "@/lib/media-strip";
import { audioContainerFor } from "@/lib/audio-container";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import { getBlockedIds } from "@/lib/blocks";
import { createNotification } from "@/lib/notifications";
import type { MessageParent } from "@/lib/chat";
import { canSeePhoto } from "@/lib/photo-visibility";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "@/lib/terms-guard";
import { serverError } from "@/lib/http";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

type ParentRow = {
  id: string;
  session_id: string;
  community_id: string;
  body: string | null;
  audio_url: string | null;
  media_path?: string | null;
  media_type?: string | null;
};

async function loadParent(
  db: ReturnType<typeof createServiceClient>,
  parentId: string,
  expectedCommunityId: string,
  requesterId: string | null
): Promise<MessageParent | null> {
  const { data: parent } = await db
    .from("community_messages")
    .select("id, session_id, community_id, body, audio_url, media_path, media_type")
    .eq("id", parentId)
    .maybeSingle();

  if (!parent) return null;
  const p = parent as ParentRow;
  if (p.community_id !== expectedCommunityId) return null;

  const { data: session } = await db
    .from("sessions")
    .select("handle, avatar_url, photo_visibility")
    .eq("id", p.session_id)
    .maybeSingle();

  let canSee = false;
  if (session) {
    let isFollowing = false;
    if (requesterId && requesterId !== p.session_id) {
      const { data: follow } = await db
        .from("follows")
        .select("followed_session_id")
        .eq("follower_session_id", requesterId)
        .eq("followed_session_id", p.session_id)
        .maybeSingle();
      isFollowing = !!follow;
    }
    canSee = canSeePhoto({
      viewerId: requesterId,
      targetId: p.session_id,
      visibility: session.photo_visibility as any,
      isFollowing
    });
  }

  return {
    id: p.id,
    author_handle: session?.handle ?? "Anonymous",
    author_avatar_url: canSee ? (session?.avatar_url ?? null) : null,
    body: p.body,
    audio_url: p.audio_url,
    media_path: p.media_path ?? null,
    media_type: p.media_type ?? null
  };
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
      .select("id, is_public")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!community) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const requesterId = await getSessionId();

    if (!community.is_public) {
      if (!requesterId) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      const { data: reqMembership } = await db
        .from("community_members")
        .select("id")
        .eq("community_id", community.id)
        .eq("session_id", requesterId)
        .maybeSingle();
      if (!reqMembership) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const blockedIds = await getBlockedIds(requesterId);

    let requesterHides = false;
    if (requesterId) {
      const { data: me } = await db
        .from("sessions")
        .select("hide_presence")
        .eq("id", requesterId)
        .maybeSingle();
      requesterHides = me?.hide_presence === true;
    }

    let q = db
      .from("community_messages")
      .select("id, session_id, body, audio_url, created_at, parent_id, media_path, media_type, viewed_at")
      .eq("community_id", community.id)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (blockedIds.size > 0) {
      q = q.not("session_id", "in", `(${Array.from(blockedIds).join(",")})`);
    }

    const { data: messages, error } = await q;

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    const ordered = (messages ?? []).reverse();

    const parentIds = Array.from(
      new Set(
        ordered
          .map((m) => m.parent_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    let parentRows: ParentRow[] = [];
    if (parentIds.length > 0) {
      const { data } = await db
        .from("community_messages")
        .select("id, session_id, community_id, body, audio_url, media_path, media_type")
        .in("id", parentIds);
      parentRows = (data ?? []) as ParentRow[];
    }

    const sessionIds = Array.from(
      new Set([
        ...ordered.map((m) => m.session_id),
        ...parentRows.map((p) => p.session_id)
      ])
    );

    const handleMap = new Map<string, string>();
    const avatarMap = new Map<string, string | null>();
    const lastSeenMap = new Map<string, string | null>();

    if (sessionIds.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle, last_seen_at, hide_presence, avatar_url, photo_visibility")
        .in("id", sessionIds);

      const myFollowingSet = new Set<string>();
      if (requesterId && sessionIds.length > 0) {
        const { data: followRows } = await db
          .from("follows")
          .select("followed_session_id")
          .eq("follower_session_id", requesterId)
          .in("followed_session_id", sessionIds);
        for (const f of (followRows ?? []) as Array<{ followed_session_id: string }>) {
          myFollowingSet.add(f.followed_session_id);
        }
      }

      for (const p of profiles ?? []) {
        handleMap.set(p.id, p.handle);
        const targetHides = requesterHides || p.hide_presence === true;
        lastSeenMap.set(p.id, targetHides ? null : (p.last_seen_at ?? null));

        const canSee = canSeePhoto({
          viewerId: requesterId,
          targetId: p.id,
          visibility: p.photo_visibility as any,
          isFollowing: myFollowingSet.has(p.id)
        });
        avatarMap.set(p.id, canSee ? p.avatar_url : null);
      }
    }

    const parentMap = new Map<string, MessageParent>();
    for (const p of parentRows) {
      parentMap.set(p.id, {
        id: p.id,
        author_handle: handleMap.get(p.session_id) ?? "Anonymous",
        author_avatar_url: avatarMap.get(p.session_id) ?? null,
        body: p.body,
        audio_url: p.audio_url,
        media_path: p.media_path ?? null,
        media_type: p.media_type ?? null
      });
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

    const output = ordered.map((m) => {
      const parentId = m.parent_id ?? null;
      return {
        id: m.id,
        body: m.body,
        audio_url: m.audio_url,
        media_path: m.media_path,
        media_type: m.media_type,
        viewed_at: m.viewed_at,
        created_at: m.created_at,
        author_handle: handleMap.get(m.session_id) ?? "Anonymous",
        author_avatar_url: avatarMap.get(m.session_id) ?? null,
        author_last_seen: lastSeenMap.get(m.session_id) ?? null,
        reactions: reactionMap.get(m.id) ?? [],
        parent_id: parentId,
        parent: parentId ? parentMap.get(parentId) ?? null : null
      };
    });

    return Response.json({ messages: output, online: onlineHandles });
  } catch (e) {
    console.error("[messages GET]", e);
    return serverError("communities/[slug]/messages", e);
  }
}

export async function POST(req: NextRequest,
  context: { params: Promise<{ slug: string }> }) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  const params = await context.params;
  try {
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
      {
        key: "community_message",
        limit: 30,
        windowMs: 60 * 1000
      },
      { ip: getRequestIp(req) }
    );

    if (!limit.ok) {
      return Response.json({ error: "Slow down — too many messages." }, { status: 429 });
    }

    const profile = await getOrCreateSessionProfile(sessionId);
    if (!profile) {
      return Response.json({ error: "no profile" }, { status: 500 });
    }

    const db = createServiceClient();

    const { data: community } = await db
      .from("communities")
      .select("id, name, slug, is_public")
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
    let voiceHeld = false;
    let audio_url: string | null = null;
    let media_path: string | null = null;
    let media_type: string | null = null;
    let media_mime: string | null = null;
    let media_size: number | null = null;
    let parentIdRaw: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      body = String(form.get("body") ?? "").trim();
      const parentField = form.get("parent_id");
      if (typeof parentField === "string" && parentField.length > 0) {
        parentIdRaw = parentField;
      }

      const audioFile = form.get("audio");
      const mediaFile = form.get("media");

      if (audioFile instanceof File && audioFile.size > 0) {
        if (audioFile.size > 5 * 1024 * 1024) {
          return Response.json({ error: "Voice note too large (max 5MB)" }, { status: 400 });
        }
        const audioId = nanoid();
        const ext = audioFile.type.includes("mp4") ? "m4a" : audioFile.type.includes("ogg") ? "ogg" : "webm";
        const path = `chat/${community.id}/${audioId}.${ext}`;
        const rawBuf = Buffer.from(await audioFile.arrayBuffer());
        const buf = await stripMediaMetadata(rawBuf, audioContainerFor(audioFile.type).ext);

        try {
          const voiceMod = await transcribeAndModerate(buf, audioFile.type || "audio/webm");
          if (voiceMod.hold) {
            voiceHeld = true;
          }
        } catch (e) {
          console.warn("[chat] voice moderation error:", e);
        }

        const up = await db.storage.from("voice-notes").upload(path, buf, {
          contentType: audioFile.type || "audio/webm",
          upsert: false
        });
        if (up.error) {
          return Response.json({ error: "Voice upload failed" }, { status: 500 });
        }
        audio_url = db.storage.from("voice-notes").getPublicUrl(path).data.publicUrl;
      }

      if (mediaFile instanceof File && mediaFile.size > 0) {
        if (community.is_public) {
          return Response.json({ error: "Public spaces cannot have view-once media." }, { status: 403 });
        }
        
        const isPhoto = mediaFile.type.startsWith("image/");
        const isVideo = mediaFile.type.startsWith("video/");
        if (!isPhoto && !isVideo) {
          return Response.json({ error: "Only photos and videos are allowed." }, { status: 400 });
        }
        if (isPhoto && mediaFile.size > 5 * 1024 * 1024) {
          return Response.json({ error: "Photo is too large (max 5MB)" }, { status: 400 });
        }
        if (isVideo && mediaFile.size > 15 * 1024 * 1024) {
          return Response.json({ error: "Video is too large (max 15MB)" }, { status: 400 });
        }

        const ext = mediaFile.name.split(".").pop() || (isPhoto ? "jpg" : "mp4");
        const mediaId = nanoid();
        const path = `chat/${community.id}/${mediaId}.${ext}`;
        const buf = Buffer.from(await mediaFile.arrayBuffer());
        
        const up = await db.storage.from("community-media").upload(path, buf, {
          contentType: mediaFile.type,
          upsert: false
        });
        if (up.error) {
          return Response.json({ error: "Media upload failed" }, { status: 500 });
        }
        media_path = path;
        media_type = isPhoto ? "photo" : "video";
        media_mime = mediaFile.type;
        media_size = mediaFile.size;
      }
    } else {
      try {
        const json = await req.json();
        body = String(json.body ?? "").trim();
        if (typeof json.parent_id === "string" && json.parent_id.length > 0) {
          parentIdRaw = json.parent_id;
        }
      } catch {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
    }

    if (!body && !audio_url && !media_path) {
      return Response.json({ error: "Message is empty" }, { status: 400 });
    }
    if (body.length > 500) {
      return Response.json({ error: "Message too long (max 500 chars)" }, { status: 400 });
    }

    let parentId: string | null = null;
    let parentSnapshot: MessageParent | null = null;
    if (parentIdRaw) {
      const snap = await loadParent(db, parentIdRaw, community.id, sessionId);
      if (snap) {
        parentId = snap.id;
        parentSnapshot = snap;
      }
    }

    let hidden = voiceHeld;
    if (body) {
      const mod = analyzeModeration(body);
      if (mod.hold) {
        hidden = true;
      }
    }

    const id = nanoid();
    const { data, error } = await db
      .from("community_messages")
      .insert({
        id,
        community_id: community.id,
        session_id: sessionId,
        body: body || null,
        audio_url,
        hidden,
        parent_id: parentId,
        ...(media_path && {
          media_path,
          media_type,
          media_mime,
          media_size
        })
      })
      .select("id, body, audio_url, created_at, hidden, parent_id, media_path, media_type, viewed_at")
      .single();

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    if (!hidden) {
      waitUntil(
        notifyCommunityMembers({
          communityId: community.id,
          senderSessionId: sessionId,
          senderHandle: profile.handle,
          communityName: community.name,
          communitySlug: community.slug,
          body: body || (media_path ? "📷 View once media" : null),
          hasAudio: !!audio_url
        }).catch((err) => {
          console.error("[push notify]", err);
        })
      );
    }

    return Response.json({
      ok: true,
      held: hidden,
      message: {
        id: data.id,
        body: data.body,
        audio_url: data.audio_url,
        media_path: data.media_path,
        media_type: data.media_type,
        viewed_at: data.viewed_at,
        created_at: data.created_at,
        author_handle: profile.handle,
        author_avatar_url: profile.avatar_url ?? null,
        author_last_seen: new Date().toISOString(),
        reactions: [],
        parent_id: data.parent_id ?? null,
        parent: parentSnapshot
      }
    });
  } catch (e) {
    console.error("[messages POST]", e);
    return serverError("communities/[slug]/messages", e);
  }
}
