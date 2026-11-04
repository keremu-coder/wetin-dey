-- 016_text_color.sql
-- Add per-session text color preference.
-- Values must match lib/text-colors.ts ids:
--   ink, leaf, adire, zobo, clay, plum, lagoon, gold
-- Existing rows default to 'ink'.

alter table public.sessions
  add column if not exists text_color text not null default 'ink';