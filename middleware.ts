import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "./lib/constants";
import { issueSessionCookieValue, sessionCookieOptions, verifySessionValue } from "./lib/session";

export async function middleware(request: NextRequest) {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await verifySessionValue(existing);
  if (valid) {
    return NextResponse.next();
  }

  const { value } = await issueSessionCookieValue();
  const res = NextResponse.next();
  res.cookies.set(COOKIE_NAME, value, sessionCookieOptions());
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json).*)"]
};