export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateRecoveryCode,
  formatRecoveryCode,
  hashRecoveryCode
} from "@/lib/recovery-code";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/http";

/**
 * GET - has this session already generated a recovery code?
 *
 * We can no longer return the code itself. Only its HMAC-SHA256 hash
 * exists in the database. If a user has lost their code, they generate
 * a new one via POST - which invalidates the old one.
 */
export async function GET() {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const db = createServiceClient();
    const { data } = await db
      .from("sessions")
      .select("recovery_code_hash")
      .eq("id", sessionId)
      .maybeSingle();

    return Response.json({
      has_code: Boolean(data?.recovery_code_hash)
    });
  } catch (e) {
    return serverError("settings/recovery-code", e);
  }
}

/**
 * POST - generate a fresh recovery code for this session.
 *
 * The plaintext code is returned exactly once. From that point only the
 * hash exists. Regenerating invalidates whatever the user had before.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "bad origin" }, { status: 403 });
    }

    const sessionId = await getSessionId();
    if (!sessionId) {
      return Response.json({ error: "no session" }, { status: 401 });
    }

    const limit = await checkRateLimit(
      sessionId,
      { key: "settings_recovery_code", limit: 5, windowMs: 3600000 },
      { ip: getRequestIp(req) }
    );
    if (!limit.ok) {
      return Response.json({ error: "Slow down — try again later." }, { status: 429 });
    }

    const db = createServiceClient();

    let plaintext: string | null = null;
    let codeHash: string | null = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateRecoveryCode();
      const candidateHash = hashRecoveryCode(candidate);
      const { data: existing } = await db
        .from("sessions")
        .select("id")
        .eq("recovery_code_hash", candidateHash)
        .maybeSingle();
      if (!existing) {
        plaintext = candidate;
        codeHash = candidateHash;
        break;
      }
    }
    if (!plaintext || !codeHash) {
      return Response.json(
        { error: "Could not generate a unique code. Try again." },
        { status: 500 }
      );
    }

    const { error } = await db
      .from("sessions")
      .update({ recovery_code_hash: codeHash })
      .eq("id", sessionId);

    if (error) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }

    // Rotating the recovery code is a security event — invalidate
    // any cookie that was issued before this moment.
    try {
      const { bumpSessionEpoch } = await import("@/lib/session");
      await bumpSessionEpoch(sessionId);
      // Re-issue the current device so the acting user stays signed in.
      const { signSessionId, sessionCookieOptions } = await import("@/lib/session");
      const fresh = await signSessionId(sessionId);
      const { cookies: nextCookies } = await import("next/headers");
      const { COOKIE_NAME } = await import("@/lib/constants");
      (await nextCookies()).set(COOKIE_NAME, fresh, sessionCookieOptions());
    } catch (e) {
      console.error("[recovery-code] epoch bump failed:", e);
    }

    return Response.json({
      ok: true,
      recovery_code: formatRecoveryCode(plaintext)
    });
  } catch (e) {
    return serverError("settings/recovery-code", e);
  }
}