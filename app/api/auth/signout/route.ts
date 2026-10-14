export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/constants";
import { sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return Response.json({ ok: true, redirect: "/signin" });
}