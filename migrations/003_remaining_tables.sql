-- Migration 003: every table the code uses that migration 001 never created.
-- After running 001 + 002 + 003, a fresh clone has the complete schema
-- that production has today. This closes reviewer P0 #3.

-- =========================
-- SESSIONS (core identity table)
-- =========================

create table if not exists public.sessions (
  id text primary key,
  handle text not null unique,
  handle_kind text not null default 'anonymous',
  display_name text,
  email text,
  phone text,
  auth_provider text,
  bio text,
  avatar_url text,
  karma integer default 0,
  verified_reporter boolean default false,
  created_at timestamptz default now(),
  follower_count integer default 0,
  following_count integer default 0,
  post_count integer default 0,
  verified_report_count integer default 0,
  last_seen_at timestamptz default now(),
  chat_sound_enabled boolean default true,
  chat_vibrate_enabled boolean default true,
  font_preference text,
  status_line text,
  status_line_updated_at timestamptz,
  availability text default 'online',
  recovery_code text unique,
  handle_changed_at timestamptz,
  previous_handles text[],
  dm_policy text not null default 'everyone',
  hide_presence boolean not null default false
);

create index if not exists sessions_handle_idx on public.sessions (handle);
create index if not exists sessions_email_idx on public.sessions (email) where email is not null;
create index if not exists sessions_last_seen_idx on public.sessions (last_seen_at desc);

-- =========================
-- COMMUNITIES (Spaces)
-- =========================

create table if not exists public.communities (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text,
  emoji text default '🇳🇬',
  is_public boolean default true,
  owner_session_id text not null,
  member_count integer default 0,
  post_count integer default 0,
  created_at timestamptz default now(),
  avatar_url text
);

create index if not exists communities_slug_idx on public.communities (slug);
create index if not exists communities_public_idx on public.communities (is_public, created_at desc);

create table if not exists public.community_members (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz default now(),
  unique (community_id, session_id)
);

create index if not exists community_members_session_idx on public.community_members (session_id);
create index if not exists community_members_community_idx on public.community_members (community_id, joined_at desc);

create table if not exists public.community_messages (
  id text primary key,
  community_id text not null references public.communities(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  body text,
  audio_url text,
  created_at timestamptz default now()
);

create index if not exists community_messages_community_idx on public.community_messages (community_id, created_at desc);
create index if not exists community_messages_session_idx on public.community_messages (session_id);

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  community_id text not null references public.communities(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  audio_url text not null,
  duration_seconds integer,
  title text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists broadcasts_community_idx on public.broadcasts (community_id, created_at desc);
create index if not exists broadcasts_expires_idx on public.broadcasts (expires_at);

create table if not exists public.checkin_requests (
  id uuid primary key default gen_random_uuid(),
  community_id text not null references public.communities(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours')
);

create index if not exists checkin_requests_community_idx on public.checkin_requests (community_id, created_at desc);
create index if not exists checkin_requests_expires_idx on public.checkin_requests (expires_at);

create table if not exists public.checkin_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.checkin_requests(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (request_id, session_id)
);

-- =========================
-- DIRECT MESSAGES
-- =========================

create table if not exists public.dm_threads (
  id text primary key,
  session_a text not null references public.sessions(id) on delete cascade,
  session_b text not null references public.sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (session_a, session_b)
);

create index if not exists dm_threads_session_a_idx on public.dm_threads (session_a, last_message_at desc);
create index if not exists dm_threads_session_b_idx on public.dm_threads (session_b, last_message_at desc);

create table if not exists public.dm_messages (
  id text primary key,
  thread_id text not null references public.dm_threads(id) on delete cascade,
  sender_id text not null references public.sessions(id) on delete cascade,
  body text not null,
  filter_level text not null default 'pass',
  filter_matches jsonb,
  held boolean not null default false,
  delivered boolean not null default true,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at desc);
create index if not exists dm_messages_held_idx on public.dm_messages (held, created_at desc) where held = true;

create table if not exists public.dm_violations (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  thread_id text references public.dm_threads(id) on delete set null,
  kind text not null,
  excerpt text,
  created_at timestamptz not null default now()
);

create index if not exists dm_violations_session_idx on public.dm_violations (session_id, created_at desc);

-- =========================
-- FOLLOWS
-- =========================

create table if not exists public.follows (
  id text primary key,
  follower_session_id text not null references public.sessions(id) on delete cascade,
  followed_session_id text not null references public.sessions(id) on delete cascade,
  created_at timestamptz default now(),
  unique (follower_session_id, followed_session_id)
);

create index if not exists follows_follower_idx on public.follows (follower_session_id);
create index if not exists follows_followed_idx on public.follows (followed_session_id);

-- =========================
-- VOTES AND REACTIONS
-- =========================

create table if not exists public.post_votes (
  id text primary key,
  post_id text not null,
  session_id text not null references public.sessions(id) on delete cascade,
  vote text not null,
  created_at timestamptz default now(),
  unique (post_id, session_id)
);

create index if not exists post_votes_post_idx on public.post_votes (post_id);
create index if not exists post_votes_session_idx on public.post_votes (session_id);

create table if not exists public.comment_votes (
  id text primary key,
  comment_id text not null references public.comments(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  vote text not null,
  created_at timestamptz default now(),
  unique (comment_id, session_id)
);

create index if not exists comment_votes_comment_idx on public.comment_votes (comment_id);
create index if not exists comment_votes_session_idx on public.comment_votes (session_id);

create table if not exists public.message_reactions (
  id text primary key,
  message_id text not null,
  session_id text not null references public.sessions(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, session_id, emoji)
);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);

create table if not exists public.reactions (
  id text primary key,
  post_id text not null,
  session_id text not null references public.sessions(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz default now(),
  unique (post_id, session_id)
);

create index if not exists reactions_post_idx on public.reactions (post_id);

-- =========================
-- REPORT REPLIES (right-of-reply submissions)
-- =========================

create table if not exists public.report_replies (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  session_id text references public.sessions(id) on delete set null,
  submitter_name text not null,
  submitter_contact text not null,
  body text not null,
  status text not null default 'pending',
  approved_at timestamptz,
  approved_by text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists report_replies_report_idx on public.report_replies (report_id, created_at desc);
create index if not exists report_replies_status_idx on public.report_replies (status, created_at desc);

-- =========================
-- TOPICS
-- =========================

create table if not exists public.topics (
  slug text primary key,
  display_name text not null,
  description text,
  post_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.topic_follows (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  topic_slug text not null references public.topics(slug) on delete cascade,
  created_at timestamptz default now(),
  unique (session_id, topic_slug)
);

create index if not exists topic_follows_session_idx on public.topic_follows (session_id);
create index if not exists topic_follows_topic_idx on public.topic_follows (topic_slug);

-- =========================
-- DAILY (prompt answers)
-- =========================

create table if not exists public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  prompt_id text not null,
  answer_date date not null,
  session_id text not null references public.sessions(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  unique (prompt_id, answer_date, session_id)
);

create index if not exists daily_answers_date_idx on public.daily_answers (answer_date desc);

-- =========================
-- RADAR SIGNALS (coarse, no precise location)
-- =========================

create table if not exists public.radar_signals (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  signal_type text not null,
  lat_bucket smallint not null,
  lng_bucket smallint not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists radar_signals_bucket_idx on public.radar_signals (lat_bucket, lng_bucket, created_at desc);
create index if not exists radar_signals_type_idx on public.radar_signals (signal_type, created_at desc);

-- =========================
-- CONTENT FLAGS (migration 001 had `flags` for reports;
-- this is the broader flag system used by /api/flag)
-- =========================

create table if not exists public.content_flags (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (session_id, target_type, target_id)
);

create index if not exists content_flags_target_idx on public.content_flags (target_type, target_id, created_at desc);
create index if not exists content_flags_status_idx on public.content_flags (status, created_at desc);

-- =========================
-- PUSH SUBSCRIPTIONS
-- =========================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_session_idx on public.push_subscriptions (session_id);

-- =========================
-- RATE EVENTS (DB-backed limiter fallback)
-- =========================

create table if not exists public.rate_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_events_session_bucket_idx
  on public.rate_events (session_id, bucket, created_at desc);

-- =========================
-- RLS
-- =========================
-- All new tables get RLS enabled. The service-role key bypasses RLS, which
-- is how every API route accesses these tables. Adding permissive policies
-- here would be decorative, same as migration 001.

alter table public.sessions enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;
alter table public.broadcasts enable row level security;
alter table public.checkin_requests enable row level security;
alter table public.checkin_responses enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_violations enable row level security;
alter table public.follows enable row level security;
alter table public.post_votes enable row level security;
alter table public.comment_votes enable row level security;
alter table public.message_reactions enable row level security;
alter table public.reactions enable row level security;
alter table public.report_replies enable row level security;
alter table public.topics enable row level security;
alter table public.topic_follows enable row level security;
alter table public.daily_answers enable row level security;
alter table public.radar_signals enable row level security;
alter table public.content_flags enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rate_events enable row level security;