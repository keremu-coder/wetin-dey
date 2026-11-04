-- 019_radar_live.sql
-- Track when a signal's location was last updated. Sender device pushes
-- updates every 30s while location_sharing = true and location_stopped = false.

alter table public.radar_signals
  add column if not exists location_updated_at timestamptz;