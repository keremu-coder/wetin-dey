export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/constants";
import { sameOrigin } from "@/lib/rate-limit";

/**
 * Clear the session cookie. Called by the client when /api/whoami returns
 * 401 with code=session_expired — meaning the cookie's HMAC is valid but
 * its epoch no longer matches the DB (revoked on another device, password
 * reset, recovery-code rotation).
 *
 * Middleware only HMAC-verifies and cannot see the epoch without a DB
 * lookup on every request, so it keeps the stale cookie. This endpoint is
 * the one-time escape hatch: delete the cookie, reload, middleware mints
 * a fresh anonymous session.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return Response.json({ ok: true });
}