-- Migration 011: reply-to-message in community chats.
--
-- Adds a nullable parent_id to community_messages so a message can
-- point at an earlier message in the same community. Null = top-level
-- message.
--
-- ON DELETE SET NULL means deleting a parent does not cascade-delete
-- the whole reply chain. Replies stay, they just lose their quote. That
-- matches how WhatsApp / Telegram / iMessage behave: you can delete a
-- message, the replies remain.
--
-- Idempotent: safe to run twice. The column and index both use
-- `if not exists`.

alter table public.community_messages
  add column if not exists parent_id text
    references public.community_messages(id) on delete set null;

create index if not exists community_messages_parent_idx
  on public.community_messages (parent_id);