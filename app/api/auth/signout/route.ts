export const runtime = "nodejs";

import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/constants";

export async function POST() {
  const jar = cookies();
  jar.delete(COOKIE_NAME);
  return Response.json({ ok: true });
}