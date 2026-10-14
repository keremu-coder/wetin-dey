-- Migration 024: enforce uniqueness on sessions.handle_lower.
--
-- Background: sessions_handle_lower_idx was a non-unique index, so
-- /api/join's select-then-update had a race window. Two concurrent
-- signups with the same handle could both pass the SELECT check and
-- both write. 28 duplicate handles accumulated this way in prod.
--
-- All duplicates were throwaway anonymous sessions (no email, no auth,
-- zero posts/comments/DMs except one DM on the older row of one pair).
-- Resolution: keep the earliest per handle, rename later ones to
-- "<handle>_<first-6-of-id>", then swap the index to UNIQUE.

with ranked as (
  select id, handle_lower,
         row_number() over (
           partition by handle_lower
           order by created_at asc
         ) as rn
    from public.sessions
   where handle_lower is not null
)
update public.sessions s
   set handle = ranked.handle_lower || '_' || left(s.id, 6)
  from ranked
 where s.id = ranked.id
   and ranked.rn > 1;

drop index if exists public.sessions_handle_lower_idx;

create unique index sessions_handle_lower_idx
  on public.sessions (handle_lower);