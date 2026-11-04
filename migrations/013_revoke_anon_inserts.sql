-- Migration 013: revoke anonymous INSERT on user-writable public tables.
--
-- Problem: migration 001 granted INSERT to anon + authenticated and
-- created insert policies with `with check (true)` on reports, comments,
-- flags, and disputes. The anon key is public by design (it ships in the
-- client bundle). Any visitor could POST directly to
-- /rest/v1/reports and bypass every server-side control:
--   - evidence requirement
--   - ban and terms checks (lib/guards.ts)
--   - per-session rate limit (lib/rate-limit.ts)
--   - defamation hold (lib/defamation.ts)
--   - auto-hide thresholds
-- The API is the only intended write path. It uses the service role key,
-- which bypasses RLS entirely. The anon grant was dead weight from day
-- one and a direct-write hole from the moment the client shipped.
--
-- Scope: reports, comments, flags, disputes. The me_toos_insert policy
-- stays — its check requires session_id = current_setting('app.session_id')
-- which can only be set by the set_app_session() function, not by an
-- arbitrary client. But we also revoke INSERT on me_toos because no
-- client path uses it; the API votes through server routes.
--
-- Idempotent: safe to re-run.
--
-- Rollback (do NOT run without restoring the exact original policy text):
--   grant insert on public.reports to anon, authenticated;
--   ... etc. See migration 001 for the original policy definitions.

-- Revoke direct insert grants.
revoke insert on public.reports  from anon, authenticated;
revoke insert on public.comments from anon, authenticated;
revoke insert on public.flags    from anon, authenticated;
revoke insert on public.disputes from anon, authenticated;
revoke insert on public.me_toos  from anon, authenticated;

-- Drop the permissive insert policies.
drop policy if exists reports_insert  on public.reports;
drop policy if exists comments_insert on public.comments;
drop policy if exists flags_insert    on public.flags;
drop policy if exists disputes_insert on public.disputes;
drop policy if exists me_toos_insert  on public.me_toos;