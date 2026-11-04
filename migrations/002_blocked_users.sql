-- Migration 002: blocked_users table.
-- The code references this table from:
--   app/api/block/route.ts
--   app/api/dm/threads/route.ts  (block check on new DM threads)
--   app/settings/blocked/page.tsx
-- but migration 001 never created it. This file fixes that drift.

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_session_id text not null,
  blocked_session_id text not null,
  created_at timestamptz not null default now(),
  constraint blocked_users_pair_unique unique (blocker_session_id, blocked_session_id),
  constraint blocked_users_no_self check (blocker_session_id <> blocked_session_id)
);

create index if not exists blocked_users_blocker_idx
  on public.blocked_users (blocker_session_id, created_at desc);

create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_session_id);

alter table public.blocked_users enable row level security;
-- No anon/authenticated policies: the service-role key (used by /api/block)
-- bypasses RLS. Adding a policy here would be decorative, same as the
-- original migration.