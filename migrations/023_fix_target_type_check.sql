-- Migration 023: fix reports_target_type_check.
--
-- The original constraint only allowed legacy values
-- (public_agency / public_official / private_individual / unknown).
-- But the app has always sent 'public' or 'private'. Result: every
-- report_am submission has been rejected with a Postgres 23514 error
-- since the constraint was created. The insert failed silently with
-- {"error":"Server error"} because the outer catch did not surface
-- the specific Postgres error.
--
-- Fix: accept both the current app values and the legacy values so
-- no existing row breaks.

alter table public.reports drop constraint if exists reports_target_type_check;

alter table public.reports
  add constraint reports_target_type_check
  check (
    target_type in (
      'public', 'private',
      'public_agency', 'public_official', 'private_individual', 'unknown'
    )
  );