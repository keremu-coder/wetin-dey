-- Migration 010: native push tokens for the Capacitor shell.
--
-- Web push (VAPID + public/sw.js) doesn't work inside the iOS WKWebView,
-- so the native app registers with APNs (iOS) or FCM (Android) and stores
-- the resulting token here. lib/push-server.ts reads this table in
-- addition to push_subscriptions when it needs to deliver a notification.

create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null,
  created_at timestamptz not null default now(),
  constraint native_push_tokens_token_unique unique (token)
);

create index if not exists native_push_tokens_session_idx
  on public.native_push_tokens (session_id);

alter table public.native_push_tokens enable row level security;
-- No anon/authenticated policies: service-role key bypasses RLS, which is
-- how every route accesses this table.