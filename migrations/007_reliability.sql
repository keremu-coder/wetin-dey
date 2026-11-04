-- Migration 007: reliability + reproducibility.
--
-- Three concerns in one migration:
--   1. sessions.auth_user_id    — for reliable Supabase Auth user deletion
--   2. sessions.handle_lower    — generated, for exact-match handle lookups
--   3. reports + comments       — columns the code uses that 001 never created
--
-- All "add column if not exists" so this is a no-op on the live DB where
-- these were added ad-hoc, and a real migration on a fresh clone.

-- ── 1. sessions.auth_user_id ──
alter table public.sessions
  add column if not exists auth_user_id uuid;

create index if not exists sessions_auth_user_id_idx
  on public.sessions (auth_user_id)
  where auth_user_id is not null;

-- ── 2. sessions.handle_lower ──
-- ilike treats % and _ as wildcards, so "block john_doe" can match
-- "johnxdoe". An exact-match column removes that class of bug entirely.
alter table public.sessions
  add column if not exists handle_lower text
  generated always as (lower(handle)) stored;

create index if not exists sessions_handle_lower_idx
  on public.sessions (handle_lower);

-- ── 3a. reports: every column the code reads or writes ──
alter table public.reports
  add column if not exists held boolean not null default false,
  add column if not exists post_type text not null default 'report_am',
  add column if not exists community_id text,
  add column if not exists author_handle text,
  add column if not exists evidence_type text,
  add column if not exists evidence_link text,
  add column if not exists evidence_label text,
  add column if not exists requires_evidence boolean not null default false,
  add column if not exists requires_manual_review boolean not null default false,
  add column if not exists is_per_post_anonymous boolean not null default false,
  add column if not exists upvotes integer not null default 0,
  add column if not exists downvotes integer not null default 0,
  add column if not exists me_too_count integer not null default 0,
  add column if not exists comment_count integer not null default 0,
  add column if not exists evidence_tier text,
  add column if not exists source_domain text,
  add column if not exists target_type text not null default 'public',
  add column if not exists defamation_risk numeric,
  add column if not exists defamation_reasons jsonb;

create index if not exists reports_held_created_idx
  on public.reports (held, created_at desc);
create index if not exists reports_post_type_created_idx
  on public.reports (post_type, created_at desc);
create index if not exists reports_community_idx
  on public.reports (community_id, created_at desc)
  where community_id is not null;
create index if not exists reports_author_handle_idx
  on public.reports (author_handle)
  where author_handle is not null;

-- ── 3b. comments: columns 001 never created ──
alter table public.comments
  add column if not exists audio_url text,
  add column if not exists transcript text,
  add column if not exists upvotes integer not null default 0,
  add column if not exists downvotes integer not null default 0,
  add column if not exists parent_id text;

create index if not exists comments_parent_idx
  on public.comments (parent_id, created_at asc)
  where parent_id is not null;

-- ── 4. Corrective note for migration 004 ──
-- Migration 004 added `hidden` to community_messages and broadcasts and
-- its comment said "reports.held already exists". That was wrong — held
-- is added by THIS migration. Do not edit 004 in place; this note is the
-- record.
comment on column public.reports.held is
  'Added in 007. Migration 004 assumed it existed — that assumption was wrong.';