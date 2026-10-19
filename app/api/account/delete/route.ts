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
    if (url.startsWith("http")) {
      const u = new URL(url);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const i = u.pathname.indexOf(marker);
      if (i >= 0) return u.pathname.slice(i + marker.length);
    } else {
      // Handle relative paths like "/bucket/folder/file.jpg"
      const marker = `/${bucket}/`;
      const i = url.indexOf(marker);
      if (i >= 0) return url.slice(i + marker.length);
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function deleteOrFail(db: any, table: string, column: string, value: string) {
  const { error } = await db.from(table).delete().eq(column, value);
  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`);
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

    // 0. Ensure the TOMBSTONE session exists so Foreign Keys don't crash
    await db.from("sessions").upsert({
      id: TOMBSTONE,
      handle: "deleted_user",
      handle_lower: "deleted_user",
      handle_kind: "anonymous",
      hide_presence: true
    }, { onConflict: "id", ignoreDuplicates: true });

    // 1. Delete Supabase Auth user
    let authDeleted = false;
    if (session.auth_user_id) {
      const { error: authDelErr } = await db.auth.admin.deleteUser(session.auth_user_id);
      if (authDelErr) return Response.json({ error: "Could not delete your sign-in record." }, { status: 500 });
      authDeleted = true;
    } else if (session.email) {
      try {
        const match = await findAuthUserByEmail(db, session.email);
        if (match) {
          const { error: authDelErr } = await db.auth.admin.deleteUser(match);
          if (authDelErr) return Response.json({ error: "Could not delete your sign-in record." }, { status: 500 });
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
          await Promise.all(userReports.map((r) => deleteReportEvidence(r.id)));
        }
      } catch (e) {
        console.error("[account/delete] evidence batch failed:", e);
        return Response.json({ error: "Could not delete your evidence files. Please try again." }, { status: 500 });
      }
    }

    // 3. Delete avatar, status photos, and space avatar blobs
    if (session.avatar_url) {
      const path = supabaseStoragePath(session.avatar_url, "user-avatars");
      if (path) {
        const { error } = await db.storage.from("user-avatars").remove([path]);
        if (error) return Response.json({ error: "Could not delete your profile photo." }, { status: 500 });
      }
    }

    // Delete status photos
    const { data: statusFiles, error: statusListErr } = await db.storage.from("status-photos").list(sessionId);
    if (statusListErr) return Response.json({ error: "Could not list status photos." }, { status: 500 });
    if (statusFiles && statusFiles.length > 0) {
      const paths = statusFiles.map(f => `${sessionId}/${f.name}`);
      const { error: statusDelErr } = await db.storage.from("status-photos").remove(paths);
      if (statusDelErr) return Response.json({ error: "Could not delete status photos." }, { status: 500 });
    }

    const { data: ownedCommunities } = await db.from("communities").select("id, avatar_url").eq("owner_session_id", sessionId);
    for (const c of ownedCommunities ?? []) {
      if (c.avatar_url) {
        const path = supabaseStoragePath(c.avatar_url, "space-avatars");
        if (path) {
          const { error } = await db.storage.from("space-avatars").remove([path]);
          if (error) return Response.json({ error: "Could not delete a space avatar." }, { status: 500 });
        }
      }
    }

    // 4. Delete broadcast blobs + broadcasts
    const { data: broadcasts } = await db.from("broadcasts").select("id, audio_url").eq("session_id", sessionId);
    for (const b of broadcasts ?? []) {
      if (b.audio_url) {
        const path = supabaseStoragePath(b.audio_url, "voice-notes");
        if (path) {
          const { error } = await db.storage.from("voice-notes").remove([path]);
          if (error) return Response.json({ error: "Could not delete a voice note." }, { status: 500 });
        }
      }
    }
    const { error: bErr } = await db.from("broadcasts").delete().eq("session_id", sessionId);
    if (bErr) return Response.json({ error: "Could not delete your broadcasts." }, { status: 500 });

    // 5. Delete chat voice notes and messages
    if (deleteContent) {
      const { data: cmAudio } = await db.from("community_messages").select("audio_url").eq("session_id", sessionId).not("audio_url", "is", null);
      for (const m of cmAudio ?? []) {
        if (m.audio_url) {
          const path = supabaseStoragePath(m.audio_url, "voice-notes");
          if (path) {
            const { error } = await db.storage.from("voice-notes").remove([path]);
            if (error) return Response.json({ error: "Could not delete a chat voice note." }, { status: 500 });
          }
        }
      }
      const { error: cmErr } = await db.from("community_messages").delete().eq("session_id", sessionId);
      if (cmErr) return Response.json({ error: "Could not delete your chat messages." }, { status: 500 });
    }

    // 6. Handle DM Threads, Media, and Messages
    const { data: dmThreads } = await db
      .from("dm_threads")
      .select("id")
      .or(`session_a.eq.${sessionId},session_b.eq.${sessionId}`);

    const threadIds = (dmThreads ?? []).map(t => t.id);

    if (threadIds.length > 0) {
      for (const tId of threadIds) {
        const { data: files, error: listErr } = await db.storage.from("dm-media").list(tId);
        if (listErr) return Response.json({ error: "Could not list your DM media files." }, { status: 500 });
        
        if (files && files.length > 0) {
          const paths = files.map(f => `${tId}/${f.name}`);
          const { error: delErr } = await db.storage.from("dm-media").remove(paths);
          if (delErr) return Response.json({ error: "Could not delete your DM media files." }, { status: 500 });
        }
      }

      if (deleteContent) {
        const { error: msgErr } = await db.from("dm_messages").delete().in("thread_id", threadIds);
        if (msgErr) return Response.json({ error: "Could not delete your direct messages." }, { status: 500 });

        const { error: thrErr } = await db.from("dm_threads").delete().in("id", threadIds);
        if (thrErr) return Response.json({ error: "Could not delete your conversation threads." }, { status: 500 });
      } else {
        // Safe because we ensured the TOMBSTONE session exists in step 0
        const { error: msgErr } = await db.from("dm_messages").update({ sender_id: TOMBSTONE, body: "[deleted]" }).eq("sender_id", sessionId);
        if (msgErr) return Response.json({ error: "Could not anonymize your direct messages." }, { status: 500 });
      }
    }

    // 7. Delete all relations and rows owned by this session
    try {
      await deleteOrFail(db, "follows", "follower_session_id", sessionId);
      await deleteOrFail(db, "follows", "followed_session_id", sessionId);
      await deleteOrFail(db, "blocked_users", "blocker_session_id", sessionId);
      await deleteOrFail(db, "blocked_users", "blocked_session_id", sessionId);
      await deleteOrFail(db, "push_subscriptions", "session_id", sessionId);
      await deleteOrFail(db, "native_push_tokens", "session_id", sessionId);
      await deleteOrFail(db, "rate_events", "session_id", sessionId);
      await deleteOrFail(db, "dm_violations", "session_id", sessionId);
      await deleteOrFail(db, "report_replies", "session_id", sessionId);
      await deleteOrFail(db, "post_votes", "session_id", sessionId);
      await deleteOrFail(db, "comment_votes", "session_id", sessionId);
      await deleteOrFail(db, "message_reactions", "session_id", sessionId);
      await deleteOrFail(db, "reactions", "session_id", sessionId);
      await deleteOrFail(db, "topic_follows", "session_id", sessionId);
      await deleteOrFail(db, "daily_answers", "session_id", sessionId);
      await deleteOrFail(db, "checkin_requests", "session_id", sessionId);
      await deleteOrFail(db, "checkin_responses", "session_id", sessionId);
      await deleteOrFail(db, "content_flags", "session_id", sessionId);
      await deleteOrFail(db, "notifications", "session_id", sessionId);
      await deleteOrFail(db, "flags", "session_id", sessionId);
      await deleteOrFail(db, "me_toos", "session_id", sessionId);
      await deleteOrFail(db, "radar_signals", "sender_id", sessionId);
      await deleteOrFail(db, "radar_signals", "recipient_id", sessionId);
      await deleteOrFail(db, "radar_contacts", "owner_id", sessionId);
      await deleteOrFail(db, "radar_contacts", "contact_id", sessionId);
      await deleteOrFail(db, "community_members", "session_id", sessionId);
    } catch (err: any) {
      console.error("[account/delete] DB deletion failed:", err);
      return Response.json({ error: err.message }, { status: 500 });
    }

    // 8. Handle Reports and Comments
    if (deleteContent) {
      const { error: rErr } = await db.from("reports").delete().eq("session_id", sessionId);
      if (rErr) return Response.json({ error: "Could not delete your reports." }, { status: 500 });
      
      const { error: cErr } = await db.from("comments").delete().eq("session_id", sessionId);
      if (cErr) return Response.json({ error: "Could not delete your comments." }, { status: 500 });
    } else {
      const { error: rErr } = await db.from("reports").update({ session_id: TOMBSTONE, author_handle: null }).eq("session_id", sessionId);
      if (rErr) return Response.json({ error: "Could not anonymize your reports." }, { status: 500 });
      
      const { error: cErr } = await db.from("comments").update({ session_id: TOMBSTONE }).eq("session_id", sessionId);
      if (cErr) return Response.json({ error: "Could not anonymize your comments." }, { status: 500 });
    }

    // 9. Scrub the sessions row (kept as ghost for DM FKs)
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

    // 10. Clear the session cookie
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

