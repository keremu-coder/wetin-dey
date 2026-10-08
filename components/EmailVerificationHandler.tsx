"use client";

import { useEffect } from "react";

/**
 * Detects the Supabase signup confirmation fragment on the URL and
 * forwards the access token to our server to mark email_verified_at.
 *
 * The fragment looks like:
 *   #access_token=...&refresh_token=...&type=signup&expires_in=...
 *
 * Runs on every page. Silent — shows nothing.
 *
 * On success we reload once so the account page picks up the new
 * verification state. The fragment is stripped from the URL first, so
 * a reload cannot re-trigger this effect.
 */
export function EmailVerificationHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");
    const accessToken = params.get("access_token");
    if (type !== "signup" || !accessToken) return;

    // Strip the fragment immediately so a reload doesn't retrigger.
    try {
      const cleanUrl =
        window.location.pathname + window.location.search;
      window.history.replaceState({}, "", cleanUrl);
    } catch {
      /* ignore */
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token: accessToken })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) {
          window.location.reload();
        }
      })
      .catch(() => {
        /* silent */
      });
  }, []);

  return null;
}