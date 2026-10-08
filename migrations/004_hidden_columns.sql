-- Migration 004: add `hidden` boolean to tables that have no hide mechanism yet.
-- comments, reports, and dm_messages already use `hidden` or `held`.

alter table public.community_messages
  add column if not exists hidden boolean not null default false;

alter table public.broadcasts
  add column if not exists hidden boolean not null default false;

create index if not exists community_messages_hidden_idx
  on public.community_messages (hidden, created_at desc);

create index if not exists broadcasts_hidden_idx
  on public.broadcasts (hidden, created_at desc);