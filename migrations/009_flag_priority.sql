-- Migration 009: high-priority flagging for civic reports.
--
-- Civic reports (post_type 'report_am') cannot be auto-hidden by
-- anonymous flagging — anti-brigading. Instead, flags on them are
-- marked priority='high' so moderators see them first in the queue.

alter table public.content_flags
  add column if not exists priority text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_flags_priority_check'
  ) then
    alter table public.content_flags
      add constraint content_flags_priority_check
      check (priority in ('normal', 'high'));
  end if;
end $$;

create index if not exists content_flags_priority_idx
  on public.content_flags (status, priority, created_at desc);