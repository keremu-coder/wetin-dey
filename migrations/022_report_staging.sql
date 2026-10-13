-- Migration 022: private staging bucket for direct-to-Supabase uploads.
--
-- Why: Vercel Hobby/Pro reject request bodies over ~4.5 MB at the edge,
-- before the function runs. That made every video evidence upload over
-- ~4.5 MB fail with 413, even though the reports route claimed a 25 MB
-- ceiling. Direct-to-Supabase uploads bypass Vercel entirely.
--
-- The client uploads to this private bucket via a signed upload URL.
-- The server then downloads, strips metadata, promotes to the public
-- evidence bucket, and deletes the staging object.

insert into storage.buckets (id, name, public)
values ('report-staging', 'report-staging', false)
on conflict (id) do nothing;