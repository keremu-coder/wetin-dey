export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Derive a safe file extension from an audio MIME type.
 * Safari/iOS MediaRecorder often emits "audio/mp4" — mislabeling that as
 * .webm causes playback failures because the browser refuses the container
 * based on the extension. Map explicitly; default to webm.
 */
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
  { params }: { params: { id: string } }
) {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("comments")
      .select(
        "id, created_at, body, audio_url, transcript, session_id, upvotes, downvotes, parent_id"
      )
      .eq("report_id", params.id)
      .eq("hidden", false)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const sessionIds = Array.from(
      new Set((data ?? []).map((c) => c.session_id).filter(Boolean))
    );

    let handleMap = new Map<string, string>();
    if (sessionIds.length > 0) {
      const { data: profiles } = await db
        .from("sessions")
        .select("id, handle")
        .in("id", sessionIds);
      handleMap = new Map((profiles ?? []).map((p) => [p.id, p.handle]));
    }

    const comments = (data ?? []).map((c) => ({
      id: c.id,
      created_at: c.created_at,
      body: c.body,
      audio_url: c.audio_url,
      transcript: c.transcript,
      parent_id: c.parent_id,
      author_handle: handleMap.get(c.session_id) ?? null,
      upvotes: c.upvotes ?? 0,
      downvotes: c.downvotes ?? 0,
      score: (c.upvotes ?? 0) - (c.downvotes ?? 0)
    }));

    return Response.json({ comments });
  } catch (e) {
    console.error("[comments GET] unexpected:", e);
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const contentType = req.headers.get("content-type") ?? "";
    const db = createServiceClient();

    let body = "";
    let parent_id: string | null = null;
    let audio_url: string | null = null;
    let transcript: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await req.formData();
      } catch (e) {
        return Response.json(
          { error: "form parse: " + (e as Error).message },
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
            { error: "Voice upload: " + up.error.message },
            { status: 500 }
          );
        }
        const pub = db.storage.from("voice-notes").getPublicUrl(path);
        audio_url = pub.data.publicUrl;
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

    // If parent_id given, verify it exists and belongs to same report
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
        hidden: false,
        upvotes: 0,
        downvotes: 0
      })
      .select("*")
      .single();

    if (error) {
      console.error("[comments POST] insert:", error);
      return Response.json(
        { error: "Insert: " + error.message },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      comment: {
        id: data.id,
        created_at: data.created_at,
        body: data.body,
        audio_url: data.audio_url,
        transcript: data.transcript,
        parent_id: data.parent_id,
        author_handle: profile.handle,
        upvotes: 0,
        downvotes: 0,
        score: 0
      }
    });
  } catch (e) {
    console.error("[comments POST] unexpected:", e);
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}