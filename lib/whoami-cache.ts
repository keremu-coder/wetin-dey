"use client";

// Shared cache for /api/whoami. Nav, ChatRoom, Settings all need the same
// user data on mount — this makes them share one network call instead of three.

export type WhoAmI = {
  id: string;
  handle: string;
  handle_kind: string;
};

let cached: WhoAmI | null = null;
let cacheTime = 0;
let inflight: Promise<WhoAmI | null> | null = null;

const TTL_MS = 60_000; // 60s

export async function getWhoAmI(): Promise<WhoAmI | null> {
  if (cached && Date.now() - cacheTime < TTL_MS) {
    return cached;
  }
  if (inflight) return inflight;

  inflight = fetch("/api/whoami")
    .then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        if (d?.handle && d?.id) {
          const next: WhoAmI = {
            id: d.id,
            handle: d.handle,
            handle_kind: d.handle_kind ?? "anonymous"
          };
          cached = next;
          cacheTime = Date.now();
          // Healthy response — clear the one-shot reset guard so a future
          // revocation can self-heal again in this tab.
          if (typeof window !== "undefined") {
            try {
              sessionStorage.removeItem("wd_session_reset_attempted");
            } catch {
              /* ignore */
            }
          }
          return next;
        }
      } else if (r.status === 401) {
        // The session cookie is stale: HMAC verifies but the epoch no
        // longer matches the DB (revoked on another device, password
        // reset, recovery-code rotation). Middleware cannot detect this
        // without a DB lookup per request, so the cookie sits there and
        // every API 401s. Clear it once and reload so middleware mints a
        // fresh anonymous session.
        //
        // The sessionStorage guard prevents an infinite reload loop if the
        // reset endpoint fails for any reason. The flag is cleared on the
        // next successful whoami.
        if (typeof window !== "undefined") {
          try {
            const body = await r.clone().json().catch(() => null);
            if (
              body?.code === "session_expired" &&
              !sessionStorage.getItem("wd_session_reset_attempted")
            ) {
              sessionStorage.setItem("wd_session_reset_attempted", "1");
              await fetch("/api/session/reset", { method: "POST" }).catch(
                () => {}
              );
              window.location.reload();
            }
          } catch {
            /* ignore */
          }
        }
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearWhoAmICache() {
  cached = null;
  inflight = null;
  cacheTime = 0;
}