export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { waitUntil } from "@vercel/functions";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyCommunityMembers } from "@/lib/push-server";
import { analyzeModeration, moderationReason } from "@/lib/dm-filter";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import { getBlockedIds } from "@/lib/blocks";
import { createNotification } from "@/lib/notifications";
import type { MessageParent } from "@/lib/chat";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "@/lib/terms-guard";

type ParentRow = {
  id: string;
  session_id: string;
  community_id: string;
  body: string | null;
  audio_url: string | null;
};

/**
 * Load a message row that a reply points at, plus the handle of the
 * person who wrote it. Returns null when the parent no longer exists
 * (ON DELETE SET NULL removes the FK value but the referenced row can
 * still be gone if the whole community was deleted).
 */
async function loadParent(
  db: ReturnType<typeof createServiceClient>,
  parentId: string,
  expectedCommunityId: string
): Promise<MessageParent | null> {
  const { data: parent } = await db
    .from("community_messages")
    .select("id, session_id, community_id, body, audio_url")
    .eq("id", parentId)
    .maybeSingle();

  if (!parent) return null;
  const p = parent as ParentRow;
  if (p.community_id !== expectedCommunityId) return null;

  const { data: session } = await db
    .from("sessions")
    .select("handle")
    .eq("id", p.session_id)
    .maybeSingle();

  return {
    id: p.id,
    author_handle: session?.handle ?? "Anonymous",
    body: p.body,
    audio_url: p.audio_url
  };
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

    const requesterId = await getSessionId();
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
      .select("id, session_id, body, audio_url, created_at, parent_id")
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

    // Fetch parents for any replies in this batch.
    const parentIds = Array.from(
      new Set(
        ordered
          .map((m) => m.parent_id)
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
      )
    );

    let parentRows: ParentRow[] = [];
    if (parentIds.length > 0) {
      const { data } = await db
        .from("community_messages")
        .select("id, session_id, community_id, body, audio_url")
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
    const lastSeenMap = new Map<string, string | null>();

    if (sessionIds.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle, last_seen_at, hide_presence")
        .in("id", sessionIds);

      for (const p of profiles ?? []) {
        handleMap.set(p.id, p.handle);
        const targetHides =
          requesterHides ||
          (p as { hide_presence?: boolean }).hide_presence === true;
        lastSeenMap.set(
          p.id,
          targetHides ? null : (p.last_seen_at ?? null)
        );
      }
    }

    const parentMap = new Map<string, MessageParent>();
    for (const p of parentRows) {
      parentMap.set(p.id, {
        id: p.id,
        author_handle: handleMap.get(p.session_id) ?? "Anonymous",
        body: p.body,
        audio_url: p.audio_url
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
        created_at: m.created_at,
        author_handle: handleMap.get(m.session_id) ?? "Anonymous",
        author_last_seen: lastSeenMap.get(m.session_id) ?? null,
        reactions: reactionMap.get(m.id) ?? [],
        parent_id: parentId,
        parent: parentId ? parentMap.get(parentId) ?? null : null
      };
    });

    return Response.json({ messages: output, online: onlineHandles });
  } catch (e) {
    console.error("[messages GET]", e);
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
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

    if (await isBanned(sessionId)) {
      return Response.json({ error: BANNED_MESSAGE }, { status: 403 });
    }

    if (!(await hasAcceptedTerms(sessionId))) {
      return Response.json(
        { error: TERMS_NOT_ACCEPTED_MESSAGE, code: TERMS_NOT_ACCEPTED_CODE },
        { status: 403 }
      );
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
    let parentIdRaw: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      body = String(form.get("body") ?? "").trim();
      const parentField = form.get("parent_id");
      if (typeof parentField === "string" && parentField.length > 0) {
        parentIdRaw = parentField;
      }
      const file = form.get("audio");

      if (file instanceof File && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return Response.json(
            { error: "Voice note too large (max 5MB)" },
            { status: 400 }
          );
        }
        const audioId = nanoid();
        const ext = file.type.includes("mp4")
          ? "m4a"
          : file.type.includes("ogg")
            ? "ogg"
            : "webm";
        const path = `chat/${community.id}/${audioId}.${ext}`;
        const buf = Buffer.from(await file.arrayBuffer());
        const up = await db.storage.from("voice-notes").upload(path, buf, {
          contentType: file.type || "audio/webm",
          upsert: false
        });
        if (up.error) {
          return Response.json(
            { error: "Voice upload failed" },
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
        if (typeof json.parent_id === "string" && json.parent_id.length > 0) {
          parentIdRaw = json.parent_id;
        }
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

    // Resolve and validate the parent, if any. Must exist and live in
    // the same community. Silently ignore an invalid parent rather than
    // 400 the whole send — the user typed a message, they don't want to
    // lose it because the reply target got deleted.
    let parentId: string | null = null;
    let parentSnapshot: MessageParent | null = null;
    if (parentIdRaw) {
      const snap = await loadParent(db, parentIdRaw, community.id);
      if (snap) {
        parentId = snap.id;
        parentSnapshot = snap;
      }
    }

    let hidden = false;
    if (body) {
      const mod = analyzeModeration(body);
      if (mod.hold) {
        hidden = true;
        console.warn(
          "[chat] held for review:",
          moderationReason(mod),
          "| matches:",
          mod.matches.map((m) => m.kind).join(",")
        );
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
        parent_id: parentId
      })
      .select("id, body, audio_url, created_at, hidden, parent_id")
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
          body: body || null,
          hasAudio: !!audio_url
        }).catch((err) => {
          console.error("[push notify]", err);
        })
      );

      // Reply + mention notifications. Both are best-effort, run after
      // the response is sent, and are deduplicated so that a reply that
      // also mentions the parent author does not produce two rows.
      //
      // The reply target's session id is tracked in `alreadyNotified`
      // so the mention pass skips them.
      waitUntil(
        (async () => {
          const alreadyNotified = new Set<string>();
          try {
            if (parentId) {
              const { data: parentRow } = await db
                .from("community_messages")
                .select("session_id")
                .eq("id", parentId)
                .maybeSingle();
              if (parentRow?.session_id) {
                alreadyNotified.add(parentRow.session_id);
                await createNotification(db, {
                  recipientId: parentRow.session_id,
                  actorId: sessionId,
                  kind: "reply",
                  targetType: "community_message",
                  targetId: id,
                  preview: body || (audio_url ? "🎤 Voice note" : null)
                });
              }
            }
          } catch (e) {
            console.error("[notify reply]", e);
          }

          // Mention pass. Only runs on text messages — voice notes have
          // no body to mention in.
          if (!body) return;

          try {
            const tokens = Array.from(
              new Set(
                (body.match(/@[A-Za-z0-9_]{2,30}/g) ?? []).map((t) =>
                  t.slice(1).toLowerCase()
                )
              )
            );
            if (tokens.length === 0) return;

            const { data: mentioners } = await db
              .from("sessions")
              .select("id, handle, handle_lower")
              .in("handle_lower", tokens);

            for (const m of mentioners ?? []) {
              if (m.id === sessionId) continue;
              if (alreadyNotified.has(m.id)) continue;
              alreadyNotified.add(m.id);
              await createNotification(db, {
                recipientId: m.id,
                actorId: sessionId,
                kind: "mention",
                targetType: "community_message",
                targetId: id,
                preview: body
              });
            }
          } catch (e) {
            console.error("[notify mention]", e);
          }
        })()
      );
    }

    return Response.json({
      ok: true,
      held: hidden,
      message: {
        id: data.id,
        body: data.body,
        audio_url: data.audio_url,
        created_at: data.created_at,
        author_handle: profile.handle,
        author_last_seen: new Date().toISOString(),
        reactions: [],
        parent_id: data.parent_id ?? null,
        parent: parentSnapshot
      }
    });
  } catch (e) {
    console.error("[messages POST]", e);
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}