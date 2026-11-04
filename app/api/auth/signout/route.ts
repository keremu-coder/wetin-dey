export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/constants";
import { sameOrigin } from "@/lib/rate-limit";
import { getSessionId, bumpSessionEpoch } from "@/lib/session";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }
  // Bump the epoch before clearing the cookie, so any previously-issued
  // cookie for this session also stops working immediately. If bumping
  // fails we still clear the local cookie.
  try {
    const sid = await getSessionId();
    if (sid) await bumpSessionEpoch(sid);
  } catch {
    /* fail-open on the local cookie deletion */
  }
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return Response.json({ ok: true, redirect: "/signin" });
}