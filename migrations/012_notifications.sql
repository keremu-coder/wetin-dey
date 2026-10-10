-- Migration 012: notifications for the in-app bell.
--
-- Stores reply / mention / comment events for the recipient. Read access
-- is entirely server-side through the service role; the client never
-- touches this table directly. Same pattern as dm_messages.
--
-- ON DELETE CASCADE on recipient_id: if a sessions row is deleted, its
-- notifications go with it. Note that account deletion does NOT delete
-- the sessions row (see DECISIONS.md), it tombstones it — so notifications
-- survive account deletion, matching how DM messages behave.
--
-- ON DELETE SET NULL on actor_id: if the actor's session is hard-deleted,
-- the notification stays but reads as "someone" instead of naming them.
--
-- Idempotent: safe to re-run.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id text not null references public.sessions(id) on delete cascade,
  actor_id text references public.sessions(id) on delete set null,
  kind text not null,
  target_type text not null,
  target_id text not null,
  preview text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_recipient_recent_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;