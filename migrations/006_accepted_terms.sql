-- Migration 006: record when a user accepted the terms and community
-- guidelines. NULL means they have never accepted.
--
-- Apple 1.2 and Google Play UGC policies both require explicit consent
-- before a user can post. The UI gates on this; the API rejects writes
-- without it.

alter table public.sessions
  add column if not exists accepted_terms_at timestamptz;

create index if not exists sessions_accepted_terms_idx
  on public.sessions (accepted_terms_at)
  where accepted_terms_at is null;