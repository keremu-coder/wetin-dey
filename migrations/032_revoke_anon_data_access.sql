-- Migration 032: revoke anon/authenticated access to reports, comments,
-- me_toos. These tables are read exclusively through API routes that use
-- the service-role client. The anon key must not be able to read them
-- directly.
--
-- Root cause (audit finding 1): migration 001 granted SELECT to anon on
-- these three tables, and migration 029 dropped some policies without
-- revoking grants. Live state showed a "reports_select_public" policy
-- that isn't in any migration. Result: anyone with the anon key (which
-- is embedded in the public JS bundle) could SELECT reports directly
-- from PostgREST, and the row-level policies did not filter held=true.
--
-- This migration:
--   1. Drops every existing policy on the three tables, whatever its
--      name, via a dynamic DO block.
--   2. Revokes SELECT/INSERT/UPDATE/DELETE from anon and authenticated.
--   3. Leaves RLS enabled (defence-in-depth; service_role bypasses it).
--
-- IMPORTANT: this only works if no client-side code reads these tables
-- via the anon-key Supabase client. All reads in this app go through
-- /api/* routes using createServiceClient(), so this should be safe.
-- If any page breaks after this migration, the cause is a client-side
-- query on one of these three tables that should be routed through an
-- API endpoint instead.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('reports', 'comments', 'me_toos')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
    raise notice 'dropped policy % on %.%',
      r.policyname, r.schemaname, r.tablename;
  end loop;
end $$;

revoke select, insert, update, delete on public.reports    from anon, authenticated;
revoke select, insert, update, delete on public.comments   from anon, authenticated;
revoke select, insert, update, delete on public.me_toos    from anon, authenticated;

-- Leave RLS enabled on all three as defence-in-depth.
alter table public.reports  enable row level security;
alter table public.comments enable row level security;
alter table public.me_toos  enable row level security;
