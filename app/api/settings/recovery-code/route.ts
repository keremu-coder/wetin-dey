export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generateRecoveryCode,
  formatRecoveryCode,
  hashRecoveryCode
} from "@/lib/recovery-code";
import { sameOrigin } from "@/lib/rate-limit";

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
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
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
      .update({
        recovery_code: plaintext,
        recovery_code_hash: codeHash
      })
      .eq("id", sessionId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      recovery_code: formatRecoveryCode(plaintext)
    });
  } catch (e) {
    return Response.json(
      { error: "Server error: " + (e as Error).message },
      { status: 500 }
    );
  }
}