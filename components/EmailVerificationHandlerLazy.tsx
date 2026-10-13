"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * Only loads EmailVerificationHandler when the URL actually carries a
 * verification token. That component imports the Supabase browser client
 * (~318 KB of gotrue crypto: Buffer, ASN.1, JWT). Loading it on every
 * page — including /signin, /join, /privacy — was burning 300 KB per
 * first paint for a code path that fires once, ever, per user.
 *
 * Correct lazy: not next/dynamic (which fires immediately when mounted),
 * but a URL-gated dynamic import that only runs when code / token_hash /
 * error_code is present in the query string.
 */
export function EmailVerificationHandler() {
  const [Comp, setComp] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const hasToken =
      url.searchParams.has("code") ||
      url.searchParams.has("token_hash") ||
      url.searchParams.has("error_code");
    if (!hasToken) return;

    let cancelled = false;
    void import("@/components/EmailVerificationHandler").then((m) => {
      if (cancelled) return;
      setComp(() => m.EmailVerificationHandler);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Comp) return null;
  return <Comp />;
}