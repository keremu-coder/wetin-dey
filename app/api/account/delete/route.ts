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

/**
 * Extracts the storage-relative path from a Supabase Storage public URL.
 * Returns null if the URL isn't from Supabase Storage.
 */
function supabaseStoragePath(
  url: string,
  bucket: string
): string | null {
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
      return Response.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    let body: DeleteBody = {};
    try {
      body = (await req.json()) as DeleteBody;
    } catch {
      return Response.json({ error: "bad json" }, { status: 400 });
    }

    if (body.confirm !== "DELETE") {
      return Response.json(
        { error: 'Type "DELETE" exactly to confirm.' },
        { status: 400 }
      );
    }

    const deleteContent = body.delete_content === true;
    const db = createServiceClient();

    const { data: session, error: sessErr } = await db
      .from("sessions")
      .select("id, handle, email, auth_user_id, avatar_url")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessErr) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    // ── 1. Delete Supabase Auth user ──
    // Prefer the stored auth_user_id. If it's missing (pre-007 row that
    // hasn't been backfilled), fall back to an email lookup. If we can't
    // delete the Auth user for any reason, return 500 and do NOT proceed
    // — the session must not be scrubbed while the login still works.
    let authDeleted = false;
    if (session.auth_user_id) {
      const { error: authDelErr } = await db.auth.admin.deleteUser(
        session.auth_user_id
      );
      if (authDelErr) {
        console.error(
          "[account/delete] auth delete failed by id:",
          authDelErr.message
        );
        return Response.json(
          {
            error:
              "Could not delete your sign-in record. Try again in a minute, or email support@wetindey.app."
          },
          { status: 500 }
        );
      }
      authDeleted = true;
    } else if (session.email) {
      try {
        const match = await findAuthUserByEmail(db, session.email);
        if (match) {
          const { error: authDelErr } = await db.auth.admin.deleteUser(match);
          if (authDelErr) {
            console.error(
              "[account/delete] auth delete failed by email fallback:",
              authDelErr.message
            );
            return Response.json(
              {
                error:
                  "Could not delete your sign-in record. Try again in a minute, or email support@wetindey.app."
              },
              { status: 500 }
            );
          }
          authDeleted = true;
        }
        // If no Auth user found for the email, there's nothing to delete.
        // Treat as success and move on.
      } catch (e) {
        console.error(
          "[account/delete] auth email fallback threw:",
          (e as Error).message
        );
        return Response.json(
          {
            error:
              "Could not check your sign-in record. Try again in a minute, or email support@wetindey.app."
          },
          { status: 500 }
        );
      }
    }

    // ── 2. Delete avatar blobs ──
    if (session.avatar_url) {
      const path = supabaseStoragePath(session.avatar_url, "user-avatars");
      if (path) {
        await db.storage
          .from("user-avatars")
          .remove([path])
          .catch(() => {});
      }
    }

    // ── 3. Delete space avatar blobs for owned communities ──
    const { data: ownedCommunities } = await db
      .from("communities")
      .select("id, avatar_url")
      .eq("owner_session_id", sessionId);

    for (const c of ownedCommunities ?? []) {
      if (c.avatar_url) {
        const path = supabaseStoragePath(c.avatar_url, "space-avatars");
        if (path) {
          await db.storage
            .from("space-avatars")
            .remove([path])
            .catch(() => {});
        }
      }
    }

    // ── 4. Delete broadcast blobs + broadcasts ──
    const { data: broadcasts } = await db
      .from("broadcasts")
      .select("id, audio_url")
      .eq("session_id", sessionId);

    for (const b of broadcasts ?? []) {
      if (b.audio_url) {
        const path = supabaseStoragePath(b.audio_url, "voice-notes");
        if (path) {
          await db.storage
            .from("voice-notes")
            .remove([path])
            .catch(() => {});
        }
      }
    }
    await db.from("broadcasts").delete().eq("session_id", sessionId);

    // ── 5. Optional: delete user's own content (comments + chat) ──
    if (deleteContent) {
      // Remove voice-note files from storage before deleting rows.
      // Without this, the public URLs keep working after account deletion.
      const { data: cmAudio } = await db
        .from("community_messages")
        .select("audio_url")
        .eq("session_id", sessionId)
        .not("audio_url", "is", null);
      for (const m of cmAudio ?? []) {
        if (m.audio_url) {
          const path = supabaseStoragePath(m.audio_url, "voice-notes");
          if (path) {
            await db.storage
              .from("voice-notes")
              .remove([path])
              .catch(() => {});
          }
        }
      }
      await db
        .from("community_messages")
        .delete()
        .eq("session_id", sessionId);
    }

    // ── 6. Delete all relations and rows owned by this session ──
    await db.from("follows").delete().eq("follower_session_id", sessionId);
    await db.from("follows").delete().eq("followed_session_id", sessionId);
    await db
      .from("blocked_users")
      .delete()
      .eq("blocker_session_id", sessionId);
    await db
      .from("blocked_users")
      .delete()
      .eq("blocked_session_id", sessionId);
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
    // Radar signals — new schema keys off sender/recipient, not session_id.
    await db.from("radar_signals").delete().eq("sender_id", sessionId);
    await db.from("radar_signals").delete().eq("recipient_id", sessionId);
    await db.from("radar_contacts").delete().eq("owner_id", sessionId);
    await db.from("radar_contacts").delete().eq("contact_id", sessionId);
    await db
      .from("community_members")
      .delete()
      .eq("session_id", sessionId);

    // ── 7. Tombstone reports + comments ──
    // Set session_id to "deleted" so content is not linkable to the
    // removed user, while keeping the reports/comments visible.
    //
    // Note: reports.session_id and comments.session_id have no FK to
    // sessions, so a sentinel string is safe.
    await db
      .from("reports")
      .update({ session_id: TOMBSTONE, author_handle: null })
      .eq("session_id", sessionId);

    await db
      .from("comments")
      .update({ session_id: TOMBSTONE })
      .eq("session_id", sessionId);

    // ── 8. What we do NOT do, and why ──
    // DM messages: dm_messages.sender_id has an FK to sessions(id), so
    // we cannot tombstone it. The sessions row is kept as a ghost (below),
    // so the FK stays valid and the other participant still sees the
    // conversation. The ghost has no email, no auth user, and a random
    // handle — it cannot log back in.

    // ── 9. Scrub the sessions row (kept as ghost) ──
    const scrubHandle = `deleted_${sessionId.slice(0, 8)}`;
    const { error: updErr } = await db
      .from("sessions")
      .update({
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
      })
      .eq("id", sessionId);

    if (updErr) {
      console.error("[account/delete] session scrub failed:", updErr.message);
      return Response.json(
        {
          error:
            "Your sign-in was removed but the profile couldn't be scrubbed. Email support@wetindey.app."
        },
        { status: 500 }
      );
    }

    // ── 10. Clear the session cookie ──
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

/**
 * Look up a Supabase Auth user id by email. Paginates through all pages
 * of users because the API caps at 1,000 per page.
 *
 * This is only used as a fallback for sessions whose auth_user_id wasn't
 * stored (pre-migration-007 rows that haven't been backfilled).
 */
async function findAuthUserByEmail(
  db: ReturnType<typeof createServiceClient>,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  const MAX_PAGES = 50; // safety cap
  while (page <= MAX_PAGES) {
    const { data } = await db.auth.admin.listUsers({ page, perPage });
    const users = data?.users ?? [];
    const match = users.find(
      (u) => (u.email ?? "").toLowerCase() === target
    );
    if (match) return match.id;
    if (users.length < perPage) return null;
    page++;
  }
  return null;
}