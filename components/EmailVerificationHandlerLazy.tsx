"use client";
import nextDynamic from "next/dynamic";

// EmailVerificationHandler imports the Supabase client, which drags in
// ~300 KB of gotrue crypto (Buffer, ASN.1, JWT). It only matters when the
// URL carries a verification ?code= — i.e. after the user has already
// signed in elsewhere. Loading it after first paint keeps the auth
// client off the critical path of /signin, /join, and every public page.
export const EmailVerificationHandler = nextDynamic(
  () => import("@/components/EmailVerificationHandler").then((m) => m.EmailVerificationHandler),
  { ssr: false }
);