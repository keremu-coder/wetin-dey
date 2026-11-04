-- Make user-avatars private and backfill existing URLs to /api/avatar/... form

update storage.buckets set public = false where id = 'user-avatars';

drop policy if exists "public read user-avatars" on storage.objects;
drop policy if exists "public read space-avatars" on storage.objects;
drop policy if exists "public read voice-notes" on storage.objects;

update public.sessions
  set avatar_url = regexp_replace(
    avatar_url,
    '^.*/storage/v1/object/public/user-avatars/',
    '/api/avatar/'
  )
  where avatar_url like '%/storage/v1/object/public/user-avatars/%';
