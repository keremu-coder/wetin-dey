-- Migration 040: pre-moderation quarantine for avatars and status photos.
--
-- Apple 1.2 (UGC) — avatars and status photos are published with no
-- filter. This adds a short quarantine so a new upload is only visible
-- to its owner until either (a) 15 minutes pass (auto-approve on read)
-- or (b) a moderator explicitly approves it.
--
-- Defaults to 'approved' so every existing row is unaffected. Only NEW
-- uploads set 'pending'.
--
-- Idempotent. Safe to re-run.

alter table public.sessions
  add column if not exists avatar_review_status text not null default 'approved'
    check (avatar_review_status in ('approved','pending','rejected'));

alter table public.sessions
  add column if not exists avatar_submitted_at timestamptz;

alter table public.sessions
  add column if not exists status_photo_review_status text not null default 'approved'
    check (status_photo_review_status in ('approved','pending','rejected'));

alter table public.sessions
  add column if not exists status_photo_submitted_at timestamptz;

create index if not exists sessions_avatar_pending_idx
  on public.sessions (avatar_submitted_at)
  where avatar_review_status = 'pending';

create index if not exists sessions_status_photo_pending_idx
  on public.sessions (status_photo_submitted_at)
  where status_photo_review_status = 'pending';