-- Migration 025: track the Telegram message id per mirrored report.
--
-- Background: the mirror cron posts reviewed reports to a Telegram
-- channel but discards the API response, which is where Telegram
-- returns `result.message_id`. Without that id, we cannot delete the
-- mirrored post later — so a report removed from our app within the
-- 24-hour takedown window would remain visible on Telegram forever.
-- That violates the takedown promise in /terms.
--
-- This migration adds the column. The bot still needs the code change
-- to persist the id, and a delete hook that runs when a report is
-- hidden from public view.

alter table public.reports
  add column if not exists telegram_message_id bigint;

create index if not exists reports_telegram_message_id_idx
  on public.reports (telegram_message_id)
  where telegram_message_id is not null;