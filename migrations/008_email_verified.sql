-- Migration 008: track when a session's email was verified.
--
-- A null email_verified_at means the account exists but the user has
-- not clicked the confirmation link Supabase sent. Password reset is
-- blocked for unverified emails to prevent takeover of an address the
-- user doesn't control.

alter table public.sessions
  add column if not exists email_verified_at timestamptz;

create index if not exists sessions_email_verified_idx
  on public.sessions (email_verified_at)
  where email_verified_at is null and email is not null;