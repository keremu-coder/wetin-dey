-- 020_radar_expires.sql
-- Auto-stop timer for location-sharing signals. Set when a need_help or
-- police_stop signal is sent. A sweep job flips location_stopped = true
-- once now() passes expires_at, so a forgotten signal never runs forever.

alter table public.radar_signals
  add column if not exists expires_at timestamptz;

create index if not exists radar_signals_expires_idx
  on public.radar_signals (expires_at)
  where location_sharing = true and location_stopped = false;