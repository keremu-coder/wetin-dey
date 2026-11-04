-- Migration 027: private bucket for daily archive exports.
--
-- Background: /api/archive/export runs daily as a Vercel cron. It
-- builds the JSON in memory and returns it as a download attachment —
-- but a cron invocation discards the response body. So the export ran
-- every day and produced nothing. That is not a backup.
--
-- Fix: also persist the JSON to this private bucket on every run. The
-- response still returns the file for manual download; the persisted
-- copy is the actual archive.

insert into storage.buckets (id, name, public)
values ('archive-export', 'archive-export', false)
on conflict (id) do nothing;