-- Migration 028: IP-based ban evasion mitigation.
--
-- Background: an anonymous user who gets banned can clear cookies and
-- mint a fresh session id, and the ban is gone. This is a real hole in
-- the moderation model, but anonymity is a core product promise — we
-- cannot require identity to post.
--
-- Mitigation: when a session is banned, also ban that session's last
-- seen IP hash for 30 days. New anonymous sessions from a banned IP
-- are refused. Signing up as a named user (verified email) is the
-- escape hatch — accountability replaces anonymity.
--
-- Limitations (accepted):
--   * Mobile carrier rotation and VPNs defeat this.
--   * Shared IPs (cafés, hostels, university NAT) get false positives.
--     The 30-day window bounds it, and named signup is always allowed.
--   * Sessions created before this migration have no last_ip_hash,
--     so a ban on them does not populate banned_ip_hashes.

alter table public.sessions
  add column if not exists last_ip_hash text;

create table if not exists public.banned_ip_hashes (
  ip_hash text primary key,
  banned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text
);

create index if not exists banned_ip_hashes_expires_idx
  on public.banned_ip_hashes (expires_at);