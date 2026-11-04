/**
 * One-time backfill: set sessions.auth_user_id for existing rows.
 *
 * Run once after migration 007 lands:
 *
 *   npx tsx scripts/backfill-auth-user-id.ts
 *
 * (npx will download tsx on first run.)
 *
 * Requires these env vars in your shell or .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function buildEmailMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const perPage = 1000;
  let page = 1;
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers failed:", error.message);
      process.exit(1);
    }
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id);
    }
    if (users.length < perPage) break;
    page++;
  }
  return map;
}

async function main() {
  console.log("Fetching Auth users...");
  const emailMap = await buildEmailMap();
  console.log(`Found ${emailMap.size} Auth users with emails.`);

  console.log("Fetching sessions without auth_user_id...");
  const { data: rows, error } = await db
    .from("sessions")
    .select("id, email")
    .is("auth_user_id", null)
    .not("email", "is", null);

  if (error) {
    console.error("sessions fetch failed:", error.message);
    process.exit(1);
  }

  const sessions = rows ?? [];
  console.log(`Found ${sessions.length} sessions to check.`);

  let updated = 0;
  let missing = 0;

  for (const s of sessions) {
    const authId = s.email ? emailMap.get(s.email.toLowerCase()) : undefined;
    if (!authId) {
      missing++;
      continue;
    }
    const { error: updErr } = await db
      .from("sessions")
      .update({ auth_user_id: authId })
      .eq("id", s.id);

    if (updErr) {
      console.error(`Failed to set auth_user_id for ${s.id}:`, updErr.message);
      continue;
    }
    updated++;
    if (updated % 50 === 0) console.log(`  ${updated} updated...`);
  }

  console.log("");
  console.log(`Done.`);
  console.log(`  Updated: ${updated}`);
  console.log(`  No matching Auth user: ${missing}`);
  console.log("");
  console.log("Safe to re-run at any time.");
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});