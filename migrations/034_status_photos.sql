-- Migration 034: Add BBM-style status photo columns to sessions.
alter table public.sessions
  add column if not exists status_photo_url text,
  add column if not exists status_photo_updated_at timestamptz;
