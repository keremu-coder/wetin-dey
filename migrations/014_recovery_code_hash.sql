-- Migration 014: add recovery_code_hash column.
--
-- Recovery codes are HMAC-SHA256 hashed before storage (see
-- lib/recovery-code.ts hashRecoveryCode). The plaintext column stays in
-- place for now — dropping it in the same migration as the code change
-- would create a window where the deployed build reads a column that no
-- longer exists. Migration 015 drops it after the code deploy is
-- confirmed healthy.
--
-- Existing plaintext codes are NOT migrated. Pre-launch there is no
-- user population worth preserving, and a reverse-mappable migration
-- would defeat the purpose of hashing. Users regenerate on next visit
-- to Settings -> Account.
--
-- Idempotent: safe to re-run.

alter table public.sessions
  add column if not exists recovery_code_hash text;

-- Unique constraint is defensive only. HMAC-SHA256 output space is 2^256;
-- a real collision is not a realistic concern. But a unique index keeps
-- a bad deploy from writing two rows with the same hash.
create unique index if not exists sessions_recovery_code_hash_key
  on public.sessions (recovery_code_hash)
  where recovery_code_hash is not null;