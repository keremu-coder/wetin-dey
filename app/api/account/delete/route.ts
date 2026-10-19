export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { COOKIE_NAME } from "@/lib/constants";
import { serverError } from "@/lib/http";

type DeleteBody = {
  confirm?: unknown;
  delete_content?: unknown;
};

const TOMBSTONE = "deleted";

function supabaseStoragePath(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = u.pathname.indexOf(marker);
    if (i >= 0) return u.pathname.slice(i + marker.length);
  } catch {
    /* ignore */
  }
  return null;
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

    const limit = await checkRateLimit(sessionId, {
      key: "account_delete",
      limit: 3,
      windowMs: 60 * 60 * 1000
    }, { ip: getRequestIp(req) });
    if (!limit.ok) {
      return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    let body: DeleteBody = {};
    try {
      body = (await req.json()) as DeleteBody;
    } catch {
      return Response.json({ error: "bad json" }, { status: 400 });
    }

    if (body.confirm !== "DELETE") {
      return Response.json({ error: 'Type "DELETE" exactly to confirm.' }, { status: 400 });
    }

    const deleteContent = body.delete_content === true;
    const db = createServiceClient();

    const { data: session, error: sessErr } = await db
      .from("sessions")
      .select("id, handle, email, auth_user_id, avatar_url")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessErr) return Response.json({ error: "Server error" }, { status: 500 });
    if (!session) return Response.json({ error: "Session not found." }, { status: 404 });

    // 1. Delete Supabase Auth user
    let authDeleted = false;
    if (session.auth_user_id) {
      const { error: authDelErr } = await db.auth.admin.deleteUser(session.auth_user_id);
      if (authDelErr) {
        return Response.json({ error: "Could not delete your sign-in record." }, { status: 500 });
      }
      authDeleted = true;
    } else if (session.email) {
      try {
        const match = await findAuthUserByEmail(db, session.email);
        if (match) {
          const { error: authDelErr } = await db.auth.admin.deleteUser(match);
          if (authDelErr) {
            return Response.json({ error: "Could not delete your sign-in record." }, { status: 500 });
          }
          authDeleted = true;
        }
      } catch (e) {
        return Response.json({ error: "Could not check your sign-in record." }, { status: 500 });
      }
    }

    // 2. Delete Evidence Files (if content deletion is requested)
    if (deleteContent) {
      try {
        const { data: userReports } = await db.from("reports").select("id").eq("session_id", sessionId);
        if (userReports && userReports.length > 0) {
          const { deleteReportEvidence } = await import("@/lib/evidence-cleanup");
          await Promise.all(userReports.map((r) => deleteReportEvidence(r.id).catch((e) => console.warn(e))));
        }
      } catch (e) {
        console.error("[account/delete] evidence batch failed:", e);
      }
    }

    // 3. Delete avatar and space avatar blobs
    if (session.avatar_url) {
      const path = supabaseStoragePath(session.avatar_url, "user-avatars");
      if (path) await db.storage.from("user-avatars").remove([path]).catch(() => {});
    }
    const { data: ownedCommunities } = await db.from("communities").select("id, avatar_url").eq("owner_session_id", sessionId);
    for (const c of ownedCommunities ?? []) {
      if (c.avatar_url) {
        const path = supabaseStoragePath(c.avatar_url, "space-avatars");
        if (path) await db.storage.from("space-avatars").remove([path]).catch(() => {});
      }
    }

    // 4. Delete broadcast blobs + broadcasts
    const { data: broadcasts } = await db.from("broadcasts").select("id, audio_url").eq("session_id", sessionId);
    for (const b of broadcasts ?? []) {
      if (b.audio_url) {
        const path = supabaseStoragePath(b.audio_url, "voice-notes");
        if (path) await db.storage.from("voice-notes").remove([path]).catch(() => {});
      }
    }
    await db.from("broadcasts").delete().eq("session_id", sessionId);

    // 5. Delete chat voice notes and messages
    if (deleteContent) {
      const { data: cmAudio } = await db.from("community_messages").select("audio_url").eq("session_id", sessionId).not("audio_url", "is", null);
      for (const m of cmAudio ?? []) {
        if (m.audio_url) {
          const path = supabaseStoragePath(m.audio_url, "voice-notes");
          if (path) await db.storage.from("voice-notes").remove([path]).catch(() => {});
        }
      }
      await db.from("community_messages").delete().eq("session_id", sessionId);
    }

    // 6. Delete all relations and rows owned by this session
    await db.from("follows").delete().eq("follower_session_id", sessionId);
    await db.from("follows").delete().eq("followed_session_id", sessionId);
    await db.from("blocked_users").delete().eq("blocker_session_id", sessionId);
    await db.from("blocked_users").delete().eq("blocked_session_id", sessionId);
    await db.from("push_subscriptions").delete().eq("session_id", sessionId);
    await db.from("native_push_tokens").delete().eq("session_id", sessionId);
    await db.from("rate_events").delete().eq("session_id", sessionId);
    await db.from("dm_violations").delete().eq("session_id", sessionId);
    await db.from("report_replies").delete().eq("session_id", sessionId);
    await db.from("post_votes").delete().eq("session_id", sessionId);
    await db.from("comment_votes").delete().eq("session_id", sessionId);
    await db.from("message_reactions").delete().eq("session_id", sessionId);
    await db.from("reactions").delete().eq("session_id", sessionId);
    await db.from("topic_follows").delete().eq("session_id", sessionId);
    await db.from("daily_answers").delete().eq("session_id", sessionId);
    await db.from("checkin_requests").delete().eq("session_id", sessionId);
    await db.from("checkin_responses").delete().eq("session_id", sessionId);
    await db.from("content_flags").delete().eq("session_id", sessionId);
    await db.from("notifications").delete().eq("session_id", sessionId);
    await db.from("flags").delete().eq("session_id", sessionId);
    await db.from("me_toos").delete().eq("session_id", sessionId);
    await db.from("radar_signals").delete().eq("sender_id", sessionId);
    await db.from("radar_signals").delete().eq("recipient_id", sessionId);
    await db.from("radar_contacts").delete().eq("owner_id", sessionId);
    await db.from("radar_contacts").delete().eq("contact_id", sessionId);
    await db.from("community_members").delete().eq("session_id", sessionId);

    // 7. Handle Reports and Comments
    if (deleteContent) {
      // APPLE COMPLIANCE: Actually delete the rows.
      // Cascade delete will handle comments on those reports.
      await db.from("reports").delete().eq("session_id", sessionId);
      // Also delete any comments they made on OTHER people's reports.
      await db.from("comments").delete().eq("session_id", sessionId);
    } else {
      // ARCHIVE INTEGRITY: Tombstone the content so it stays visible
      // but is detached from the deleted user.
      await db.from("reports").update({ session_id: TOMBSTONE, author_handle: null }).eq("session_id", sessionId);
      await db.from("comments").update({ session_id: TOMBSTONE }).eq("session_id", sessionId);
    }

    // 8. Scrub the sessions row (kept as ghost for DM FKs)
    const scrubHandle = `deleted_${sessionId.slice(0, 8)}`;
    const { error: updErr } = await db.from("sessions").update({
      handle: scrubHandle,
      handle_kind: "anonymous",
      display_name: null,
      email: null,
      phone: null,
      auth_provider: "none",
      auth_user_id: null,
      bio: null,
      avatar_url: null,
      status_line: null,
      status_line_updated_at: null,
      availability: null,
      recovery_code: null,
      recovery_code_hash: null,
      previous_handles: null,
      dm_policy: "everyone",
      hide_presence: true,
      accepted_terms_at: null
    }).eq("id", sessionId);

    if (updErr) {
      return Response.json({ error: "Your sign-in was removed but the profile couldn't be scrubbed." }, { status: 500 });
    }

    // 9. Clear the session cookie
    const res = NextResponse.json({ ok: true, auth_deleted: authDeleted });
    res.cookies.set({
      name: COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    return res;

  } catch (e) {
    console.error("[account/delete]", e);
    return serverError("account/delete", e);
  }
}

async function findAuthUserByEmail(db: ReturnType<typeof createServiceClient>, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  const MAX_PAGES = 50;
  while (page <= MAX_PAGES) {
    const { data } = await db.auth.admin.listUsers({ page, perPage });
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (users.length < perPage) return null;
    page++;
  }
  return null;
}
