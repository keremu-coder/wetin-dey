-- Migration 030: Enable RLS on radar_contacts and banned_ip_hashes.
--
-- The security audit (C8) found these two tables were missing RLS.
-- The application uses the Supabase service role key for all access to 
-- these tables, which bypasses RLS. Enabling RLS with no policies 
-- locks down direct anon-key access without breaking the application.

alter table public.radar_contacts enable row level security;
alter table public.banned_ip_hashes enable row level security;
