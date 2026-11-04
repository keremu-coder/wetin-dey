/**
 * Normalise stored image URLs to the same-origin private-media proxies.
 * Since migration 036 the `user-avatars` bucket is PRIVATE, so old absolute
 * Supabase "public" URLs can never load. Map them to:
 *   avatar : /api/avatar/{ownerId}/{file}
 *   status : /api/status-photo/{ownerId}/{file}
 */

const LEGACY_AVATAR =
  /\/storage\/v1\/object\/(?:public|sign|authenticated)\/user-avatars\/(.+?)(?:\?.*)?$/;

export function normalizeMediaUrl(
  src: string | null | undefined
): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/api/avatar/") || trimmed.startsWith("/api/status-photo/")) {
    return trimmed.split(/[?#]/, 1)[0];
  }

  const m = trimmed.match(LEGACY_AVATAR);
  if (!m) return trimmed;

  const rest = m[1];
  if (rest.startsWith("status/")) {
    return `/api/status-photo/${rest.slice("status/".length)}`;
  }
  return `/api/avatar/${rest}`;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic"
};

export function imageContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "image/jpeg";
}