export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { waitUntil } from "@vercel/functions";
import { createNotification } from "@/lib/notifications";
import { transcribeAndModerate } from "@/lib/voice-moderation";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeModeration, moderationReason } from "@/lib/dm-filter";
import { isBanned, BANNED_MESSAGE } from "@/lib/ban-guard";
import { getBlockedIds } from "@/lib/blocks";
import {
  hasAcceptedTerms,
  TERMS_NOT_ACCEPTED_CODE,
  TERMS_NOT_ACCEPTED_MESSAGE
} from "@/lib/terms-guard";
import { serverError } from "@/lib/http";

function extForAudioType(t: string | undefined): string {
  const lower = (t ?? "").toLowerCase();
  if (lower.includes("mp4") || lower.includes("m4a")) return "m4a";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  if (lower.includes("webm")) return "webm";
  return "webm";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
  try {
    const sessionId = await getSessionId();
    const blockedIds = await getBlockedIds(sessionId);

    const db = createServiceClient();
    let q = db
      .from("comments")
      .select(
        "id, created_at, body, audio_url, transcript, session_id, upvotes, downvotes, parent_id"
      )
      .eq("report_id", params.id)
      .eq("hidden", false)
      .order("created_at", { ascending: true })
      .limit(500);

    if (blockedIds.size > 0) {
      q = q.not("session_id", "in", `(${Array.from(blockedIds).join(",")})`);
    }

    const { data, error } = await q;

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    const sessionIds = Array.from(
      new Set((data ?? []).map((c) => c.session_id).filter(Boolean))
    );

    let handleMap = new Map<string, string>();
    let colorMap = new Map<string, string | null>();
    let fontMap = new Map<string, string | null>();
    if (sessionIds.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle, text_color, font_preference")
        .in("id", sessionIds);
      handleMap = new Map((profiles ?? []).map((p) => [p.id, p.handle]));
      colorMap = new Map((profiles ?? []).map((p) => [p.id, (p as { text_color?: string | null }).text_color ?? null]));
      fontMap = new Map((profiles ?? []).map((p) => [p.id, (p as { font_preference?: string | null }).font_preference ?? null]));
    }

    const comments = (data ?? []).map((c) => ({
      id: c.id,
      created_at: c.created_at,
      body: c.body,
      audio_url: c.audio_url,
      transcript: c.transcript,
      parent_id: c.parent_id,
      author_handle: handleMap.get(c.session_id) ?? null,
      author_color: colorMap.get(c.session_id) ?? null,
      author_font: fontMap.get(c.session_id) ?? null,
      upvotes: c.upvotes ?? 0,
      downvotes: c.downvotes ?? 0,
      score: (c.upvotes ?? 0) - (c.downvotes ?? 0)
    }));

    return Response.json({ comments });
  } catch (e) {
    console.error("[comments GET] unexpected:", e);
    return serverError("reports/[id]/comments", e);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const profile = await getOrCreateSessionProfile(sessionId);
    if (!profile) {
      return Response.json({ error: "no profile" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    const db = createServiceClient();

    let body = "";
    let parent_id: string | null = null;
    let audio_url: string | null = null;
    let transcript: string | null = null;
    let voiceHeld = false;

    if (contentType.includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await req.formData();
      } catch (e) {
        return Response.json(
          { error: "Bad request" },
          { status: 400 }
        );
      }

      body = String(form.get("body") ?? "").trim();
      const parentRaw = String(form.get("parent_id") ?? "").trim();
      parent_id = parentRaw || null;

      const file = form.get("audio");
      if (file instanceof File && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return Response.json(
            { error: "Voice note too large (max 5MB)" },
            { status: 400 }
          );
        }
        const audioId = nanoid();
        const ext = extForAudioType(file.type);
        const path = `${audioId}.${ext}`;
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
        const pub = db.storage.from("voice-notes").getPublicUrl(path);
        audio_url = pub.data.publicUrl;

        // Voice moderation — Whisper transcribe + text filter.
        // Best-effort: fails open on any error.
        try {
          const voiceMod = await transcribeAndModerate(
            buf,
            file.type || "audio/webm"
          );
          if (voiceMod.transcript) {
            transcript = voiceMod.transcript;
          }
          if (voiceMod.hold) {
            voiceHeld = true;
            console.warn(
              "[comments] voice held for review:",
              voiceMod.reasons.join(" | ")
            );
          }
        } catch (e) {
          console.warn("[comments] voice moderation error:", e);
        }
      }
    } else {
      try {
        const json = await req.json();
        body = String(json.body ?? "").trim();
        parent_id = json.parent_id ? String(json.parent_id) : null;
      } catch {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
    }

    if (!body && !audio_url) {
      return Response.json({ error: "Comment cannot be empty" }, { status: 400 });
    }
    if (body.length > 1000) {
      return Response.json(
        { error: "Comment too long (max 1000 chars)" },
        { status: 400 }
      );
    }

    if (parent_id) {
      const { data: parent } = await db
        .from("comments")
        .select("id, report_id")
        .eq("id", parent_id)
        .maybeSingle();
      if (!parent || parent.report_id !== params.id) {
        return Response.json({ error: "Reply target not found" }, { status: 404 });
      }
    }

    let hidden = voiceHeld;
    if (body) {
      const mod = analyzeModeration(body);
      if (mod.hold) {
        hidden = true;
        console.warn(
          "[comments] held for review:",
          moderationReason(mod),
          "| matches:",
          mod.matches.map((m) => m.kind).join(",")
        );
      }
    }

    const id = nanoid();
    const { data, error } = await db
      .from("comments")
      .insert({
        id,
        report_id: params.id,
        body: body || "(voice note)",
        audio_url,
        transcript,
        parent_id,
        session_id: sessionId,
        reviewed: false,
        hidden,
        upvotes: 0,
        downvotes: 0
      })
      .select("*")
      .single();

    if (error) {
      console.error("[comments POST] insert:", error);
      return Response.json(
        { error: "Server error" },
        { status: 500 }
      );
    }

    // Best-effort: notify the report author when someone comments on
    // their report. Runs after the response, skips replies-to-comments
    // (v1 scope — comment replies do not notify, to avoid spam on long
    // threads). The notification helper handles self-check and block
    // check.
    if (!parent_id) {
      waitUntil(
        (async () => {
          try {
            const { data: reportRow } = await db
              .from("reports")
              .select("session_id")
              .eq("id", params.id)
              .maybeSingle();
            if (reportRow?.session_id) {
              await createNotification(db, {
                recipientId: reportRow.session_id,
                actorId: sessionId,
                kind: "comment",
                targetType: "report",
                targetId: params.id,
                preview: body || (audio_url ? "🎤 Voice note" : null)
              });
            }
          } catch (e) {
            console.error("[notify comment]", e);
          }
        })()
      );
    }

    return Response.json({
      ok: true,
      held: hidden,
      comment: {
        id: data.id,
        created_at: data.created_at,
        body: data.body,
        audio_url: data.audio_url,
        transcript: data.transcript,
        parent_id: data.parent_id,
        author_handle: profile.handle,
        author_color: (profile as { text_color?: string | null }).text_color ?? null,
        author_font: (profile as { font_preference?: string | null }).font_preference ?? null,
        upvotes: 0,
        downvotes: 0,
        score: 0
      }
    });
  } catch (e) {
    console.error("[comments POST] unexpected:", e);
    return serverError("reports/[id]/comments", e);
  }
}