export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/constants";
import { signSessionId, sessionCookieOptions } from "@/lib/session";
import {
  normalizeRecoveryCode,
  isValidRecoveryCodeFormat,
  hashRecoveryCode
} from "@/lib/recovery-code";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const body = (await req.json()) as { recovery_code?: unknown };
    if (typeof body.recovery_code !== "string") {
      return Response.json(
        { error: "Recovery code required." },
        { status: 400 }
      );
    }

    const normalized = normalizeRecoveryCode(body.recovery_code);
    if (!isValidRecoveryCodeFormat(normalized)) {
      return Response.json(
        { error: "That doesn't look like a valid recovery code." },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Hash the normalized input, then look up by hash. We never
    // compare plaintext in memory or in the DB query.
    const codeHash = hashRecoveryCode(normalized);
    const { data: session } = await db
      .from("sessions")
      .select("id, handle, recovery_code_hash")
      .eq("recovery_code_hash", codeHash)
      .maybeSingle();

    if (!session) {
      // Rate limit failed attempts by IP-less heuristic — use the code prefix
      // as a bucket key. Not perfect but stops trivial brute force.
      const limit = await checkRateLimit(
        `recovery:${normalized.slice(0, 4)}`,
        {
          key: "recovery_fail",
          limit: 10,
          windowMs: 15 * 60 * 1000
        },
        { ip: getRequestIp(req) }
      );
      if (!limit.ok) {
        return Response.json(
          { error: "Too many attempts. Try again later." },
          { status: 429 }
        );
      }
      return Response.json(
        { error: "That recovery code was not found. Check it and try again." },
        { status: 404 }
      );
    }

    // Sign this user in: issue a session cookie pointing to the found id.
    const cookieValue = await signSessionId(session.id);
    const opts = sessionCookieOptions();
    const cookieString = [
      `${COOKIE_NAME}=${cookieValue}`,
      `Path=${opts.path}`,
      `Max-Age=${opts.maxAge}`,
      "SameSite=Lax",
      opts.secure ? "Secure" : ""
    ]
      .filter(Boolean)
      .join("; ");

    const res = Response.json({
      ok: true,
      handle: session.handle,
      redirect: "/"
    });
    res.headers.append("Set-Cookie", cookieString);
    return res;
  } catch (e) {
    console.error("[route-error]", e);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}