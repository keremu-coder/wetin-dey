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
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d?.handle && d?.id) {
        const next: WhoAmI = {
          id: d.id,
          handle: d.handle,
          handle_kind: d.handle_kind ?? "anonymous"
        };
        cached = next;
        cacheTime = Date.now();
        return next;
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