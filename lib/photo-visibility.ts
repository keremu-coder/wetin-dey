export type PhotoVisibility = "private" | "followers" | "public";

export function canSeePhoto(opts: {
  viewerId: string | null;
  targetId: string;
  visibility: string | null | undefined; // Expanded to string to handle odd DB values
  isFollowing: boolean;
}): boolean {
  // Owner can always see their own photo
  if (opts.viewerId && opts.viewerId === opts.targetId) return true;

  // Normalize the stored value (lowercase, trim)
  const v = (opts.visibility ?? "private").toString().toLowerCase().trim();

  // Handle public aliases
  if (v === "public" || v === "everyone") return true;
  
  // Handle followers
  if (v === "followers" || v === "follower") return opts.isFollowing;

  // Default to private
  return false;
}

export function maskPhoto(
  photo: string | null | undefined,
  visible: boolean
): string | null {
  return visible ? (photo ?? null) : null;
}
/**
 * Auto-approve window for newly uploaded avatars and status photos.
 * During this window only the owner can see the new photo (others see
 * the Alama fallback). After the window, the proxy route lazily flips
 * the row to 'approved' on the next read. Matches Apple 1.2's "filter
 * or pre-approval" requirement without burdening a moderator with every
 * upload. Flag-based post-moderation is a separate pipeline.
 */
export const PHOTO_PENDING_AUTO_APPROVE_MS = 15 * 60 * 1000;