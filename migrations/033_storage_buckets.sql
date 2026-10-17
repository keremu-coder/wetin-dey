-- Migration 033: define storage buckets that exist in code but not in
-- any migration.
--
-- Audit finding 18: `user-avatars`, `space-avatars` and `voice-notes`
-- are referenced everywhere in the app via getPublicUrl() and .upload(),
-- but no migration creates them. Live state on any fresh environment
-- would fail until an operator manually created them. This migration
-- makes the app reproducible from migrations alone.
--
-- `evidence` (001) and `archive-export` (027) are already defined.
--
-- Design notes:
--   * user-avatars, space-avatars, voice-notes are PUBLIC because the
--     code calls getPublicUrl(). If we later move to signed URLs
--     (deferred: Batch C follow-up), these flip to private.
--   * voice-notes holds chat audio and voice comments. It will move to
--     private in the same signed-URL migration. Logged in BACKLOG.
--   * RLS is enabled on all three. Public read is granted via a policy
--     scoped to the bucket. No insert/update/delete for anon or
--     authenticated — all writes go through the service role.

insert into storage.buckets (id, name, public)
values
  ('user-avatars',   'user-avatars',   true),
  ('space-avatars',  'space-avatars',  true),
  ('voice-notes',    'voice-notes',    true)
on conflict (id) do nothing;

-- Public read policy for each bucket.
drop policy if exists "public read user-avatars" on storage.objects;
create policy "public read user-avatars"
  on storage.objects for select
  using (bucket_id = 'user-avatars');

drop policy if exists "public read space-avatars" on storage.objects;
create policy "public read space-avatars"
  on storage.objects for select
  using (bucket_id = 'space-avatars');

drop policy if exists "public read voice-notes" on storage.objects;
create policy "public read voice-notes"
  on storage.objects for select
  using (bucket_id = 'voice-notes');
