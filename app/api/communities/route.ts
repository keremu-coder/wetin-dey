export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { slugify, isValidSlug } from "@/lib/community";
import { assertCanWrite } from "@/lib/guards";
import { sameOrigin, checkRateLimit, getRequestIp } from "@/lib/rate-limit";

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
    // Audit finding 17: the previous .or() filter interpolated `q` into
    // PostgREST filter syntax. A comma or paren in `q` could inject
    // additional conditions (e.g. `q="x),is_public.eq.false"`). Escaping
    // LIKE wildcards was not enough. Fix: filter by name OR slug via
    // two separate .ilike() calls combined with .or(...) is unsafe;
    // instead we query once with a single LIKE (case-insensitive) on
    // both columns using the Postgres OR inside .or() BUT with `q`
    // stripped of PostgREST filter metacharacters AND quoted.
    //
    // The safest approach without changing the SQL: strip any character
    // that has meaning to PostgREST filter syntax, then wrap in quotes.
    const cleaned = q.replace(/[(),]/g, "").replace(/[\\%_]/g, "\\$&");
    // PostgREST accepts double-quoted values in filter expressions.
    // Reject if cleaning emptied it (avoid a filter that matches all).
    if (cleaned.length > 0) {
      query = query.or(
        `name.ilike."%${cleaned}%",slug.ilike."%${cleaned}%"`
      );
    }
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: "Server error" }, { status: 500 });
  return Response.json({ communities: data ?? [] });
}

export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin state-changing requests.
  if (!sameOrigin(req)) {
    return Response.json({ error: "bad origin" }, { status: 403 });
  }

  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });

  const denied = await assertCanWrite(sessionId);
  if (denied) return denied;

  const limit = await checkRateLimit(
    sessionId,
    { key: "community_create", limit: 5, windowMs: 3600000 },
    { ip: getRequestIp(req) }
  );
  if (!limit.ok) {
    return Response.json({ error: "Slow down — too many requests." }, { status: 429 });
  }

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
    return Response.json({ error: "Server error" }, { status: 500 });
  }

  await db.from("community_members").insert({
    id: nanoid(),
    community_id: id,
    session_id: sessionId,
    role: "owner"
  });

  return Response.json({ ok: true, community: created });
}