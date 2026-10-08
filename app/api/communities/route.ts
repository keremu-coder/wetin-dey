export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { slugify, isValidSlug } from "@/lib/community";
import { assertCanWrite } from "@/lib/guards";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const db = createServiceClient();
  let query = db
    .from("communities")
    .select("id, slug, name, description, emoji, is_public, member_count, post_count, created_at")
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .limit(50);

  if (q) {
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ communities: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

  const denied = await assertCanWrite(sessionId);
  if (denied) return denied;

  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) return Response.json({ error: "no profile" }, { status: 500 });

  let body: {
    name?: string;
    slug?: string;
    description?: string;
    emoji?: string;
    is_public?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 3 || name.length > 50) {
    return Response.json({ error: "Name must be 3–50 characters." }, { status: 400 });
  }

  const slug = slugify(String(body.slug ?? "") || name);
  if (!isValidSlug(slug)) {
    return Response.json(
      { error: "Slug must be lowercase letters, numbers, and hyphens only." },
      { status: 400 }
    );
  }

  const description = String(body.description ?? "").trim().slice(0, 300);
  const emoji = String(body.emoji ?? "🇳🇬").trim().slice(0, 8) || "🇳🇬";
  const isPublic = body.is_public !== false;

  const db = createServiceClient();

  const { data: existing } = await db
    .from("communities")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    return Response.json({ error: "That slug is already taken." }, { status: 409 });
  }

  const id = nanoid();
  const { data: created, error } = await db
    .from("communities")
    .insert({
      id,
      slug,
      name,
      description: description || null,
      emoji,
      is_public: isPublic,
      owner_session_id: sessionId
    })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await db.from("community_members").insert({
    id: nanoid(),
    community_id: id,
    session_id: sessionId,
    role: "owner"
  });

  return Response.json({ ok: true, community: created });
}