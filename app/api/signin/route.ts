export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { signSessionId, sessionCookieOptions } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/constants";
import { sameOrigin, checkIpRateLimit } from "@/lib/rate-limit";
import {
  describeAuthError,
  isEmailNotConfirmed,
  passwordCheckedBeforeConfirmation
} from "@/lib/signin-auth";

const BAD_LOGIN = "Email or password no correct.";

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => "\\" + c);
}

function newAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type ProfileRow = { id: string; handle: string; auth_user_id: string | null };

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  const limit = await checkIpRateLimit(req, {
    key: "signin",
    limit: 10,
    windowMs: 15 * 60 * 1000
  });
  if (!limit.ok) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password || email.length > 254 || password.length > 256) {
    return Response.json({ error: "Email and password required." }, { status: 400 });
  }

  const { data: authData, error: authErr } =
    await newAnonClient().auth.signInWithPassword({ email, password });

  let authUserId: string | null = authData?.user?.id ?? null;

  if (authErr || !authUserId) {
    console.error("[signin] auth rejected:", describeAuthError(authErr));

    const passwordProvenCorrect =
      isEmailNotConfirmed(authErr) &&
      (await passwordCheckedBeforeConfirmation(async () => {
        const { error } = await newAnonClient().auth.signInWithPassword({
          email,
          password: `${crypto.randomUUID()}${crypto.randomUUID()}`
        });
        return error;
      }));

    if (!passwordProvenCorrect) {
      return Response.json({ error: BAD_LOGIN }, { status: 401 });
    }
  }

  const db = createServiceClient();

  let profile: ProfileRow | null = null;
  let profileErr: { message: string } | null = null;
  let matchedByEmail = false;

  if (authUserId) {
    const res = await db
      .from("sessions")
      .select("id, handle, auth_user_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    profile = (res.data as ProfileRow | null) ?? null;
    profileErr = res.error;
  }

  if (!profile && !profileErr) {
    const res = await db
      .from("sessions")
      .select("id, handle, auth_user_id")
      .ilike("email", escapeLike(email))
      .maybeSingle();
    profile = (res.data as ProfileRow | null) ?? null;
    profileErr = res.error;
    matchedByEmail = !!profile;
  }

  if (profileErr) {
    console.error("[signin] profile lookup failed:", profileErr.message);
    return Response.json({ error: "Server error" }, { status: 500 });
  }

  if (!profile) {
    console.error(
      "[signin] auth ok but no sessions row for auth user",
      authUserId ?? "(unconfirmed account, resolved by email)"
    );
    return Response.json({ error: BAD_LOGIN }, { status: 401 });
  }

  if (!authUserId) {
    const linked = profile.auth_user_id;
    const { data: owner } = linked
      ? await db.auth.admin.getUserById(linked)
      : { data: null };
    if ((owner?.user?.email ?? "").toLowerCase() !== email) {
      console.error(
        "[signin] unconfirmed account: sessions row is not linked to the Auth user for this email",
        profile.id
      );
      return Response.json({ error: BAD_LOGIN }, { status: 401 });
    }
    authUserId = owner!.user!.id;
  }

  if (matchedByEmail && profile.auth_user_id !== authUserId) {
    let danglingOrEmpty = !profile.auth_user_id;
    if (profile.auth_user_id) {
      const { data: old } = await db.auth.admin.getUserById(profile.auth_user_id);
      danglingOrEmpty = !old?.user;
    }
    if (danglingOrEmpty) {
      const { error: healErr } = await db
        .from("sessions")
        .update({ auth_user_id: authUserId })
        .eq("id", profile.id);
      if (healErr) {
        console.error("[signin] could not relink auth_user_id:", healErr.message);
      }
    } else {
      console.error(
        "[signin] email row is linked to a different live Auth user; not relinking",
        profile.id
      );
    }
  }

  const cookieValue = await signSessionId(profile.id);
  (await cookies()).set(COOKIE_NAME, cookieValue, sessionCookieOptions());

  return Response.json({ ok: true, handle: profile.handle });
}
