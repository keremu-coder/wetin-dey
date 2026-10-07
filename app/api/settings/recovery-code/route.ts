export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { generateRecoveryCode, formatRecoveryCode } from "@/lib/recovery-code";
import { sameOrigin } from "@/lib/rate-limit";

/**
 * GET — return current recovery code for this session (if any).
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
      .select("recovery_code")
      .eq("id", sessionId)
      .maybeSingle();

    if (!data?.recovery_code) {
      return Response.json({ recovery_code: null });
    }

    return Response.json({
      recovery_code: formatRecoveryCode(data.recovery_code)
    });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST — generate a fresh recovery code for the current session.
 * If the session already has one, we replace it (user might have lost it).
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

    const db = createServiceClient();

    // Collision-safe loop (99.99% first try, but be safe)
    let code: string | null = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateRecoveryCode();
      const { data: existing } = await db
        .from("sessions")
        .select("id")
        .eq("recovery_code", candidate)
        .maybeSingle();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      return Response.json(
        { error: "Could not generate a unique code. Try again." },
        { status: 500 }
      );
    }

    const { error } = await db
      .from("sessions")
      .update({ recovery_code: code })
      .eq("id", sessionId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      recovery_code: formatRecoveryCode(code)
    });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}