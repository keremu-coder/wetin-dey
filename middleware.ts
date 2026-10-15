import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "./lib/constants";
import { issueSessionCookieValue, sessionCookieOptions, verifySessionValue } from "./lib/session";

/**
 * Build the CSP with a per-request nonce. Every inline <script> the app
 * renders (only the theme bootstrap in app/layout.tsx today) must carry
 * this nonce; Next.js automatically attaches the same nonce to its own
 * runtime scripts because it reads the `x-csp-nonce` request header.
 *
 * script-src drops 'unsafe-inline' and uses a nonce + strict-dynamic.
 * style-src keeps 'unsafe-inline' because Next injects an inline style
 * block at boot; that's a lower-severity class of issue.
 *
 * 'unsafe-eval' is added ONLY outside production. Next.js dev mode uses
 * eval() in react-refresh-utils for hot module reloading, and
 * 'strict-dynamic' forbids eval unless 'unsafe-eval' is also listed.
 * Production builds do not eval, so the keyword never ships live.
 *
 * Vercel's preview toolbar (vercel.live) is only allowed outside production.
 */
const IS_PROD = process.env.NODE_ENV === "production";
const DEV_LIVE = IS_PROD ? "" : " https://vercel.live";
const DEV_EVAL = IS_PROD ? "" : " 'unsafe-eval'";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${DEV_EVAL}${DEV_LIVE}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' blob: https://*.supabase.co",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://api.telegram.org${DEV_LIVE}`,
    `frame-src ${IS_PROD ? "'none'" : "https://vercel.live"}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await verifySessionValue(existing);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (!valid) {
    const { value } = await issueSessionCookieValue();
    res.cookies.set(COOKIE_NAME, value, sessionCookieOptions());
  }

  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json).*)"]
};