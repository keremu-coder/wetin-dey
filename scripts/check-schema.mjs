// Usage: node scripts/check-schema.mjs
//
// Reads .env.local, connects to Supabase with the service role key,
// and checks that every table the app expects actually exists.
//
// For each expected table, tries a zero-row select. If PostgREST
// replies "relation ... does not exist", the table is missing. Any
// other reply (200, 401, 403, permission error) means the table
// exists — the check is purely about existence, not access.
//
// Exits 0 if all tables exist, 1 if any are missing.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_TABLES = [
  // Identity
  "sessions",
  // Civic reports
  "reports",
  "comments",
  "comment_votes",
  "report_replies",
  // Community feed
  "posts",
  "post_votes",
  // Spaces
  "communities",
  "community_members",
  "community_messages",
  "broadcasts",
  // Reactions
  "reactions",
  "message_reactions",
  // Social graph
  "follows",
  "blocked_users",
  // Direct messages
  "dm_threads",
  "dm_messages",
  "dm_violations",
  // Push
  "push_subscriptions",
  "native_push_tokens",
  // Rate limiting + moderation
  "rate_events",
  "content_flags",
  // Misc
  "topic_follows",
  "daily_answers",
  "checkin_requests",
  "checkin_responses",
  "radar_signals"
];

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    console.error("Could not read .env.local:", e.message);
    process.exit(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const results = [];

  for (const table of EXPECTED_TABLES) {
    const { error } = await db.from(table).select("*").limit(0);
    if (!error) {
      results.push({ table, status: "ok" });
      continue;
    }
    // PostgREST signals a missing table with code 42P01 (undefined_table)
    // or a message containing "does not exist". Anything else — 401, 403,
    // permission denied — means the table exists but we can't read it,
    // which for existence purposes is still a pass.
    const code = error.code ?? "";
    const msg = error.message ?? "";
    const missing =
      code === "42P01" || msg.toLowerCase().includes("does not exist");
    results.push({
      table,
      status: missing ? "missing" : "ok",
      note: missing ? msg : undefined
    });
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const missing = results.filter((r) => r.status === "missing");

  console.log("");
  for (const r of results) {
    const mark = r.status === "ok" ? "  ok   " : " MISS  ";
    console.log(`${mark} ${r.table}${r.note ? `  (${r.note})` : ""}`);
  }
  console.log("");
  console.log(`Checked ${results.length} tables. OK: ${ok}. Missing: ${missing.length}.`);

  if (missing.length > 0) {
    console.error("\nSchema drift detected. Apply the missing migrations.");
    process.exit(1);
  }

  console.log("Schema matches expectations.");
  process.exit(0);
}

main().catch((e) => {
  console.error("check-schema crashed:", e);
  process.exit(1);
});