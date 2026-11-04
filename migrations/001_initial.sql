-- Enable required extensions
create extension if not exists pgcrypto;

-- =========================
-- TABLES
-- =========================

create table if not exists public.reports (
  id text primary key,
  created_at timestamptz not null default now(),
  category text not null check (category in (
    'electricity','police','customs','local_govt','judiciary','hospital','school','other'
  )),
  agency_raw text not null,
  agency_canonical text,
  state text not null,
  lga text,
  body text not null check (char_length(body) between 50 and 5000),
  amount_kobo bigint,
  evidence_url text,
  summary_pidgin text,
  summary_english text,
  incident_date date,
  status text not null default 'reported' check (status in (
    'reported','forwarded','acknowledged','resolved','disputed'
  )),
  reviewed boolean not null default false,
  reviewer_note text,
  session_id text not null,
  formalization_confidence numeric,
  dedupe_hash text
);

create table if not exists public.comments (
  id text primary key,
  report_id text not null references public.reports(id),
  created_at timestamptz not null default now(),
  body text not null check (char_length(body) between 1 and 2000),
  session_id text not null,
  reviewed boolean not null default false,
  hidden boolean not null default false
);

create table if not exists public.me_toos (
  id text primary key,
  report_id text not null references public.reports(id),
  created_at timestamptz not null default now(),
  session_id text not null,
  unique (report_id, session_id)
);

create table if not exists public.flags (
  id text primary key,
  report_id text not null references public.reports(id),
  created_at timestamptz not null default now(),
  reason text not null,
  session_id text not null,
  resolved boolean not null default false
);

create table if not exists public.disputes (
  id text primary key,
  report_id text not null references public.reports(id),
  created_at timestamptz not null default now(),
  claimant_name text not null,
  claimant_contact text not null,
  explanation text not null,
  resolved boolean not null default false
);

create table if not exists public.formalization_log (
  id text primary key,
  report_id text not null references public.reports(id),
  created_at timestamptz not null default now(),
  prompt_tokens integer,
  completion_tokens integer,
  model text,
  success boolean not null,
  error text
);

create table if not exists public.moderation_actions (
  id text primary key,
  report_id text,
  action text not null,
  moderator_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  session_id text primary key,
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_reviewed_idx on public.reports (reviewed, created_at desc);
create index if not exists reports_session_idx on public.reports (session_id);
create index if not exists comments_report_idx on public.comments (report_id, created_at desc);
create index if not exists flags_unresolved_idx on public.flags (resolved, created_at desc);
create index if not exists disputes_unresolved_idx on public.disputes (resolved, created_at desc);

-- =========================
-- SESSION HELPER
-- =========================

create or replace function public.set_app_session(sid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if sid is null or length(sid) < 8 or length(sid) > 64 then
    raise exception 'invalid session';
  end if;
  perform set_config('app.session_id', sid, true);
end;
$$;

revoke all on function public.set_app_session(text) from public;
grant execute on function public.set_app_session(text) to anon, authenticated, service_role;

-- =========================
-- RATE LIMIT TRIGGERS (Postgres enforcement)
-- Reports: reject INSERT if same session_id inserted >10 reports in last hour
-- Comments: 20/hour per session (API also enforces 20/hour)
-- =========================

create or replace function public.reject_report_flood()
returns trigger
language plpgsql
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.reports
  where session_id = new.session_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception 'rate limit: too many reports for this session';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit
before insert on public.reports
for each row execute function public.reject_report_flood();

create or replace function public.reject_comment_flood()
returns trigger
language plpgsql
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.comments
  where session_id = new.session_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 20 then
    raise exception 'rate limit: too many comments for this session';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
before insert on public.comments
for each row execute function public.reject_comment_flood();

-- =========================
-- RLS
-- =========================

alter table public.reports enable row level security;
alter table public.comments enable row level security;
alter table public.me_toos enable row level security;
alter table public.flags enable row level security;
alter table public.disputes enable row level security;
alter table public.formalization_log enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.admins enable row level security;

-- reports: SELECT if reviewed=true OR session_id = current_setting('app.session_id'); INSERT allowed; UPDATE/DELETE service-role only.
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
for select
to anon, authenticated
using (
  reviewed = true
  or session_id = current_setting('app.session_id', true)
);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
for insert
to anon, authenticated
with check (true);

-- comments: SELECT where hidden=false; INSERT allowed; DELETE service-role only.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
for select
to anon, authenticated
using (hidden = false);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
for insert
to anon, authenticated
with check (true);

-- me_toos: SELECT open; INSERT if session_id matches own.
drop policy if exists me_toos_select on public.me_toos;
create policy me_toos_select on public.me_toos
for select
to anon, authenticated
using (true);

drop policy if exists me_toos_insert on public.me_toos;
create policy me_toos_insert on public.me_toos
for insert
to anon, authenticated
with check (session_id = current_setting('app.session_id', true));

-- flags/disputes: INSERT open; SELECT/UPDATE service-role only.
drop policy if exists flags_insert on public.flags;
create policy flags_insert on public.flags
for insert
to anon, authenticated
with check (true);

drop policy if exists disputes_insert on public.disputes;
create policy disputes_insert on public.disputes
for insert
to anon, authenticated
with check (true);

-- formalization_log, moderation_actions, admins: service-role only (no anon/authenticated policies)

grant usage on schema public to anon, authenticated, service_role;

grant select, insert on public.reports to anon, authenticated;
grant select, insert on public.comments to anon, authenticated;
grant select, insert on public.me_toos to anon, authenticated;
grant insert on public.flags to anon, authenticated;
grant insert on public.disputes to anon, authenticated;

grant all on public.reports to service_role;
grant all on public.comments to service_role;
grant all on public.me_toos to service_role;
grant all on public.flags to service_role;
grant all on public.disputes to service_role;
grant all on public.formalization_log to service_role;
grant all on public.moderation_actions to service_role;
grant all on public.admins to service_role;

-- =========================
-- STORAGE
-- =========================

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do update set public = true;

drop policy if exists evidence_public_read on storage.objects;
create policy evidence_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'evidence');
