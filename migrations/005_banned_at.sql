-- Migration 005: add banned_at to sessions.
-- A non-null banned_at means the session is banned from posting.
-- Moderators can ban via /admin/flags when a user repeatedly posts
-- content that violates the guidelines.

alter table public.sessions
  add column if not exists banned_at timestamptz;

alter table public.sessions
  add column if not exists ban_reason text;

create index if not exists sessions_banned_idx
  on public.sessions (banned_at)
  where banned_at is not null;