-- Migration 029: drop stale anon insert policies + wide-open sessions read policy.
--
-- Context: migration 013 revoked the anon/authenticated INSERT grants on
-- reports, comments, flags, disputes, and me_toos, and tried to drop the
-- corresponding insert policies. The revokes worked — verified empirically,
-- anon POST returns 401 on every one of those tables. But the policy drops
-- did not match: the actual policy names are *_insert_anon, not *_insert.
-- The policies remain in pg_policies, inert today because the grant is gone,
-- but a landmine if any future migration re-grants INSERT.
--
-- Also drops sessions_read_public, which is SELECT USING true for role
-- public. Currently inert (grant on sessions revoked, anon GET returns 401)
-- but would expose every email, phone, and recovery code hash if the grant
-- is ever restored. Replacement deferred — reports_select_public uses the
-- same x-session-id header contract, and any replacement policy should be
-- reviewed alongside that.
--
-- Idempotent. Safe to re-run.

drop policy if exists reports_insert_anon  on public.reports;
drop policy if exists comments_insert_anon on public.comments;
drop policy if exists flags_insert_anon    on public.flags;
drop policy if exists disputes_insert_anon on public.disputes;
drop policy if exists me_toos_insert_anon  on public.me_toos;
drop policy if exists sessions_read_public on public.sessions;