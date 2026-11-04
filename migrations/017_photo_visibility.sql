-- 017_photo_visibility.sql
alter table public.sessions
  add column if not exists photo_visibility text not null default 'private';