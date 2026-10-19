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
