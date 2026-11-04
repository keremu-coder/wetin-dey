-- Migration 021: security hardening.
-- Idempotent — safe to re-run.

-- 1. Recovery codes: only the HMAC is kept. Wipe plaintext from any
--    session that predates this change. Users regenerate their code in
--    Settings -> Account if they need a fresh one.
update public.sessions
   set recovery_code = null
 where recovery_code is not null;

-- 2. Radar: speed up the reciprocal-contact check used before delivery.
create index if not exists radar_contacts_contact_owner_idx
  on public.radar_contacts (contact_id, owner_id);