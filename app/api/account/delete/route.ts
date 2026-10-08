export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sameOrigin, checkRateLimit } from "@/lib/rate-limit";
import { COOKIE_NAME } from "@/lib/constants";

type DeleteBody = {
  confirm?: unknown;
  delete_content?: unknown;
};

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
    });
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
      .select("id, handle, email")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessErr) {
      return Response.json({ error: sessErr.message }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    // 1. Delete Supabase Auth user if one exists for this email.
    //    We don't store the auth user id on the sessions row, so we
    //    look it up by email. Fine for early-stage user counts.
    if (session.email) {
      const email: string = session.email;
      try {
        const { data: list } = await db.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        const match = list?.users?.find((u) => u.email === email) ?? null;
        if (match) {
          await db.auth.admin.deleteUser(match.id);
        }
      } catch (e) {
        console.error(
          "[account/delete] auth delete failed:",
          (e as Error).message
        );
        // Continue — session row wipe still matters.
      }
    }

    // 2. Optional: delete the user's own content (comments + chat).
    //    Reports stay (archive integrity). DM messages stay (they would
    //    disappear from the other person's view too).
    if (deleteContent) {
      await db.from("comment_votes").delete().eq("session_id", sessionId);
      await db.from("comments").delete().eq("session_id", sessionId);
      await db
        .from("community_messages")
        .delete()
        .eq("session_id", sessionId);
    }

    // 3. Delete relations (both directions).
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
    await db.from("rate_events").delete().eq("session_id", sessionId);
    await db.from("dm_violations").delete().eq("session_id", sessionId);

    // 4. Scrub the sessions row. Handle is not-null, so we rename it
    //    to a synthetic value that frees the original handle.
    const deletedHandle = `deleted_${sessionId.slice(0, 8)}`;
    const { error: updErr } = await db
      .from("sessions")
      .update({
        handle: deletedHandle,
        handle_kind: "anonymous",
        display_name: null,
        email: null,
        phone: null,
        auth_provider: "none",
        bio: null,
        avatar_url: null,
        status_line: null,
        status_line_updated_at: null,
        availability: null,
        recovery_code: null,
        previous_handles: null,
        dm_policy: "everyone",
        hide_presence: true
      })
      .eq("id", sessionId);

    if (updErr) {
      return Response.json({ error: updErr.message }, { status: 500 });
    }

    // 5. Clear the session cookie.
    const res = NextResponse.json({ ok: true });
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
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}