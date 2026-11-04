export const STATUS_PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

const OWNER_ID_PATTERN = /^[\w-]{8,64}$/;
const FILE_PATTERN = /^[\w-]{1,80}\.(jpg|jpeg|png|webp)$/i;

export function extractStatusPhotoFilename(
  storedUrl: string | null | undefined,
  ownerId: string
): string | null {
  if (!storedUrl || !OWNER_ID_PATTERN.test(ownerId)) return null;

  const proxyPrefix = `/api/status-photo/${ownerId}/`;
  let filename: string | null = null;

  if (storedUrl.startsWith(proxyPrefix)) {
    filename = storedUrl.slice(proxyPrefix.length).split(/[/?#]/, 1)[0] ?? null;
  } else if (storedUrl.startsWith("status/")) {
    const parts = storedUrl.split("/");
    if (parts.length === 3 && parts[1] === ownerId) filename = parts[2];
  } else {
    try {
      const pathname = new URL(storedUrl).pathname;
      const legacyPrefix =
        `/storage/v1/object/public/user-avatars/status/${ownerId}/`;
      const index = pathname.indexOf(legacyPrefix);
      if (index >= 0) {
        filename = pathname
          .slice(index + legacyPrefix.length)
          .split(/[/?#]/, 1)[0] ?? null;
      }
    } catch {
      return null;
    }
  }

  return filename && FILE_PATTERN.test(filename) ? filename : null;
}

export function statusPhotoProxyUrl(
  storedUrl: string | null | undefined,
  ownerId: string
): string | null {
  const filename = extractStatusPhotoFilename(storedUrl, ownerId);
  return filename ? `/api/status-photo/${ownerId}/${filename}` : null;
}

export function statusPhotoStoragePath(
  ownerId: string,
  filename: string
): string {
  return `status/${ownerId}/${filename}`;
}

export function isStatusPhotoActive(
  updatedAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!updatedAt) return false;
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= 0 && age < STATUS_PHOTO_TTL_MS;
}