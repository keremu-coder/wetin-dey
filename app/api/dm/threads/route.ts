export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { orderParticipants } from "@/lib/dm";
import { sameOrigin } from "@/lib/rate-limit";
import { assertCanWrite } from "@/lib/guards";
import { serverError } from "@/lib/http";

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();

    const [threadsA, threadsB] = await Promise.all([
      db
        .from("dm_threads")
        .select("id, session_a, session_b, last_message_at")
        .eq("session_a", sessionId)
        .order("last_message_at", { ascending: false })
        .limit(100),
      db
        .from("dm_threads")
        .select("id, session_a, session_b, last_message_at")
        .eq("session_b", sessionId)
        .order("last_message_at", { ascending: false })
        .limit(100)
    ]);

    const threads = [...(threadsA.data ?? []), ...(threadsB.data ?? [])].sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime()
    );

    if (threads.length === 0) {
      return Response.json({ threads: [] });
    }

    const otherIds = threads.map((t) =>
      t.session_a === sessionId ? t.session_b : t.session_a
    );

    const { data: sessions } = await db
      .from("sessions")
      .select("id, handle")
      .in("id", otherIds);

    const handleMap = new Map<string, string>();
    for (const s of sessions ?? []) handleMap.set(s.id, s.handle);

    const threadIds = threads.map((t) => t.id);
    const { data: recentMessages } = await db
      .from("dm_messages")
      .select("thread_id, sender_id, body, created_at, held")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false })
      .limit(threadIds.length * 3);

    const lastByThread = new Map<
      string,
      { body: string; sender_id: string; created_at: string; held: boolean }
    >();
    for (const m of recentMessages ?? []) {
      if (m.held) continue;
      if (!lastByThread.has(m.thread_id)) {
        lastByThread.set(m.thread_id, {
          body: m.body,
          sender_id: m.sender_id,
          created_at: m.created_at,
          held: m.held
        });
      }
    }

    return Response.json({
      threads: threads.map((t) => {
        const other = t.session_a === sessionId ? t.session_b : t.session_a;
        const last = lastByThread.get(t.id) ?? null;
        return {
          id: t.id,
          other_id: other,
          other_handle: handleMap.get(other) ?? "Anonymous",
          last_message_at: t.last_message_at,
          last_body: last?.body ?? null,
          last_from_me: last ? last.sender_id === sessionId : false
        };
      })
    });
  } catch (e) {
    return serverError("dm/threads", e);
  }
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

    const me = await getOrCreateSessionProfile(sessionId);
    if (!me) {
      return Response.json({ error: "no profile" }, { status: 500 });
    }

    const body = (await req.json()) as { target_handle?: unknown };
    if (typeof body.target_handle !== "string" || !body.target_handle.trim()) {
      return Response.json(
        { error: "target_handle required" },
        { status: 400 }
      );
    }

    const targetHandle = body.target_handle.trim().toLowerCase();

    if (targetHandle === me.handle.toLowerCase()) {
      return Response.json(
        { error: "You can't DM yourself." },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    const { data: target } = await db
      .from("sessions")
      .select("id, handle, dm_policy")
      .eq("handle_lower", targetHandle)
      .maybeSingle();

    if (!target) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    const [blockedByMe, blockedByThem] = await Promise.all([
      db
        .from("blocked_users")
        .select("id")
        .eq("blocker_session_id", sessionId)
        .eq("blocked_session_id", target.id)
        .maybeSingle(),
      db
        .from("blocked_users")
        .select("id")
        .eq("blocker_session_id", target.id)
        .eq("blocked_session_id", sessionId)
        .maybeSingle()
    ]);

    if (blockedByMe.data || blockedByThem.data) {
      return Response.json(
        { error: "You can't message this person." },
        { status: 403 }
      );
    }

    const [a, b] = orderParticipants(sessionId, target.id);

    const { data: existing } = await db
      .from("dm_threads")
      .select("id")
      .eq("session_a", a)
      .eq("session_b", b)
      .maybeSingle();

    if (existing) {
      return Response.json({ ok: true, thread_id: existing.id });
    }

    const targetPolicy = target.dm_policy === "following" ? "following" : "everyone";

    if (targetPolicy === "following") {
      const { data: follows } = await db
        .from("follows")
        .select("id")
        .eq("follower_session_id", target.id)
        .eq("followed_session_id", sessionId)
        .maybeSingle();

      if (!follows) {
        return Response.json(
          {
            error:
              "This person only allows messages from people they follow. Follow them first, or wait for them to follow you back."
          },
          { status: 403 }
        );
      }
    }

    const id = nanoid();
    const { error } = await db.from("dm_threads").insert({
      id,
      session_a: a,
      session_b: b
    });

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    return Response.json({ ok: true, thread_id: id });
  } catch (e) {
    return serverError("dm/threads", e);
  }
}