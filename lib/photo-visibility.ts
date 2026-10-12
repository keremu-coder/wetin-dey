export type PhotoVisibility = "private" | "followers" | "public";

export function canSeePhoto(opts: {
  viewerId: string | null;
  targetId: string;
  visibility: PhotoVisibility | null | undefined;
  isFollowing: boolean;
}): boolean {
  if (opts.viewerId && opts.viewerId === opts.targetId) return true;
  const v = opts.visibility ?? "private";
  if (v === "public") return true;
  if (v === "followers" && opts.isFollowing) return true;
  return false;
}

export function maskPhoto(
  photo: string | null | undefined,
  visible: boolean
): string | null {
  return visible ? (photo ?? null) : null;
}