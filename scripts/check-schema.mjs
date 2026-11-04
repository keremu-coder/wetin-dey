// Usage: node scripts/check-schema.mjs
//
// Reads .env.local, connects to Supabase with the service role key,
// and checks:
//   1. Every table the app expects exists.
//   2. Every column the app reads from those tables exists.
//
// Table check: zero-row select against the table. PostgREST replies
// "relation ... does not exist" (code 42P01) when missing.
//
// Column check: zero-row select naming specific columns. PostgREST
// replies "column X does not exist" (code 42703) when missing.
//
// Exits 0 if all tables and columns exist, 1 otherwise.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_TABLES = [
  "sessions",
  "reports",
  "comments",
  "comment_votes",
  "report_replies",
  // NOTE: "posts" was in the original roadmap but was superseded by
  // reports.post_type. Nothing in the code reads from it. Removed 2026-10-10.
  "post_votes",
  "communities",
  "community_members",
  "community_messages",
  "broadcasts",
  "reactions",
  "message_reactions",
  "follows",
  "blocked_users",
  "dm_threads",
  "dm_messages",
  "dm_violations",
  "push_subscriptions",
  "native_push_tokens",
  "rate_events",
  "content_flags",
  "topic_follows",
  "daily_answers",
  "checkin_requests",
  "checkin_responses",
  "radar_signals"
];

// Columns the app reads from each table. Anything named here must exist
// in the live DB, or the app will 500 on a query.
const EXPECTED_COLUMNS = {
  sessions: [
    "id",
    "handle",
    "last_seen_at",
    "hide_presence",
    "status_line",
    "availability",
    "font_preference",
    "handle_lower"
  ],
  reports: [
    "id",
    "session_id",
    "body",
    "agency_canonical",
    "agency_raw",
    "state",
    "lga",
    "category",
    "status",
    "summary_pidgin",
    "summary_english",
    "amount_kobo",
    "evidence_type",
    "evidence_url",
    "evidence_link",
    "evidence_label",
    "evidence_tier",
    "reviewed",
    "held",
    "created_at",
    "post_type",
    "community_id"
  ],
  communities: [
    "id",
    "slug",
    "name",
    "emoji",
    "avatar_url",
    "member_count",
    "post_count",
    "is_public"
  ],
  community_members: [
    "community_id",
    "session_id",
    "role",
    "joined_at"
  ],
  community_messages: [
    "id",
    "community_id",
    "session_id",
    "body",
    "audio_url",
    "created_at",
    "hidden",
    "parent_id"
  ],
  dm_threads: [
    "id",
    "session_a",
    "session_b",
    "created_at",
    "last_message_at"
  ],
  dm_messages: [
    "id",
    "thread_id",
    "sender_id",
    "body",
    "held",
    "read_at",
    "created_at"
  ]
};

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    // .env.local is missing when running in CI. Vercel and GitHub Actions
    // set env vars directly. Fall through silently.
    return;
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

function isMissingTable(error) {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  // Postgres raw: 42P01 / "relation does not exist"
  // PostgREST schema cache: PGRST205 / "Could not find the table"
  if (code === "42P01" || code === "PGRST205") return true;
  if (msg.includes("could not find the table")) return true;
  if (msg.includes("relation") && msg.includes("does not exist")) return true;
  return false;
}

function isMissingColumn(error) {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  // Postgres raw: 42703 / "column X does not exist"
  // PostgREST schema cache: PGRST204 / "Could not find the 'X' column"
  if (code === "42703" || code === "PGRST204") return true;
  if (msg.includes("could not find the") && msg.includes("column")) return true;
  if (msg.includes("column") && msg.includes("does not exist")) return true;
  // Anything else mentioning "column" that reached us is likely a real
  // column problem — err on the side of failing loudly.
  return msg.includes("column");
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const problems = [];

  console.log("");
  console.log("Tables:");
  for (const table of EXPECTED_TABLES) {
    const { error } = await db.from(table).select("*").limit(0);
    if (!error) {
      console.log(`  ok    ${table}`);
    } else if (isMissingTable(error)) {
      console.log(`  MISS  ${table}  (${error.message})`);
      problems.push({ kind: "table", name: table, note: error.message });
    } else {
      // Not a "missing" error (permission, etc.) — for existence this is a pass.
      console.log(`  ok    ${table}  (${error.message})`);
    }
  }

  console.log("");
  console.log("Columns:");
  for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
    const colList = columns.join(",");
    const { error } = await db.from(table).select(colList).limit(0);
    if (!error) {
      console.log(`  ok    ${table}  (${columns.length} columns)`);
    } else if (isMissingColumn(error)) {
      console.log(`  MISS  ${table}  (${error.message})`);
      problems.push({ kind: "column", name: `${table}.${colList}`, note: error.message });
    } else {
      console.log(`  ok    ${table}  (${error.message})`);
    }
  }

  console.log("");
  if (problems.length === 0) {
    console.log("Schema matches expectations.");
    process.exit(0);
  }

  console.log(`Schema drift detected: ${problems.length} problem(s).`);
  for (const p of problems) {
    console.log(`  ${p.kind}: ${p.name}  —  ${p.note}`);
  }
  console.log("");
  console.log("Apply the missing migrations in Supabase SQL Editor, then re-run.");
  process.exit(1);
}

main().catch((e) => {
  console.error("check-schema crashed:", e);
  process.exit(1);
});