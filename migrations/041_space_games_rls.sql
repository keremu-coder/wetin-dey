-- Enable RLS on space_games
alter table public.space_games enable row level security;

-- Allow anyone to read games (necessary for Realtime subscriptions)
drop policy if exists "space_games_select" on public.space_games;
create policy "space_games_select"
  on public.space_games for select
  using (true);

-- Only the service role (API routes) can insert, update, or delete.
-- No policies are created for those commands.
