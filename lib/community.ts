import { createServiceClient } from "./supabase/server";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function isValidSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(s);
}

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string;
  is_public: boolean;
  owner_session_id: string;
  member_count: number;
  post_count: number;
  created_at: string;
};

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Community) ?? null;
}

export async function isMember(
  communityId: string,
  sessionId: string | null
): Promise<{ member: boolean; role: string | null }> {
  if (!sessionId) return { member: false, role: null };
  const db = createServiceClient();
  const { data } = await db
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("session_id", sessionId)
    .maybeSingle();
  return { member: !!data, role: data?.role ?? null };
}