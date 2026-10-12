-- 018_radar_signals.sql
-- Private safety signals between trusted contacts.
-- Not public UGC — signals go only from sender to their chosen recipients.

create table if not exists public.radar_contacts (
  owner_id uuid not null,
  contact_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id)
);

create index if not exists radar_contacts_contact_idx on public.radar_contacts (contact_id);

create table if not exists public.radar_signals (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  recipient_id uuid not null,
  signal_type text not null check (signal_type in ('safe','home','on_way','need_help','call_me','police_stop')),
  note text,
  lat double precision,
  lng double precision,
  location_sharing boolean not null default false,
  location_stopped boolean not null default false,
  acknowledged_at timestamptz,
  acknowledged_note text,
  created_at timestamptz not null default now()
);

create index if not exists radar_signals_recipient_idx on public.radar_signals (recipient_id, acknowledged_at, created_at desc);
create index if not exists radar_signals_sender_idx on public.radar_signals (sender_id, created_at desc);