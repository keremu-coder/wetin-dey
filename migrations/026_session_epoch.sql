-- Migration 026: session epoch for cookie revocation.
--
-- Background: cookies are stateless HMACs. A stolen cookie used to
-- stay valid for the full 90-day lifetime — signout, password reset,
-- and recovery-code rotation did not invalidate it.
--
-- Fix: bind the cookie to a session_epoch integer stored on the row.
-- Signout / password reset / recovery-code rotation each bump the
-- epoch. getSessionId verifies the epoch on every request (cached for
-- 30s per instance), so any cookie issued before the bump stops
-- working within one cache window.

alter table public.sessions
  add column if not exists session_epoch int not null default 1;