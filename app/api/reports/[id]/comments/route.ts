export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("comments")
      .select(
        "id, created_at, body, audio_url, transcript, session_id, upvotes, downvotes"
      )
      .eq("report_id", params.id)
      .eq("hidden", false)
      .order("created_at", { ascending: true })
      .limit(200);

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
      const file = form.get("audio");

      if (file instanceof File && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return Response.json(
            { error: "Voice note too large (max 5MB)" },
            { status: 400 }
          );
        }

        const audioId = nanoid();
        const path = `${audioId}.webm`;
        const buf = Buffer.from(await file.arrayBuffer());

        const up = await db.storage.from("voice-notes").upload(path, buf, {
          contentType: file.type || "audio/webm",
          upsert: false
        });

        if (up.error) {
          console.error("[comments POST] storage upload:", up.error);
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
      } catch {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
    }

    if (!body && !audio_url) {
      return Response.json({ error: "Comment no fit empty" }, { status: 400 });
    }
    if (body.length > 1000) {
      return Response.json(
        { error: "Comment too long (max 1000 chars)" },
        { status: 400 }
      );
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