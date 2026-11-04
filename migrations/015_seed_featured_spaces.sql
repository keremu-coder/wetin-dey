-- Migration 015: seed the six featured public spaces.
--
-- Idempotent: uses where-not-exists on slug, safe to re-run.
--
-- owner_session_id references sessions(id). We grab the oldest session
-- as a placeholder owner. These spaces are not owned by anyone in a
-- meaningful sense; they are platform-seeded for discovery. If the
-- sessions table is empty (fresh install), the insert is skipped and
-- the app just shows the "no spaces yet" empty state as before.
--
-- member_count and post_count stay at 0. We do not inflate them. The
-- UI presents empty spaces with a "be the first" line rather than fake
-- numbers. Honesty over optics.

insert into public.communities
  (id, slug, name, description, emoji, is_public, owner_session_id, member_count, post_count)
select
  'space-naija-market',
  'naija-market',
  'Naija Market',
  'Buy, sell, find. Anywhere in Naija. Dealers, goods, services - no middleman tax.',
  '🛒',
  true,
  (select id from public.sessions order by created_at asc limit 1),
  0,
  0
where not exists (select 1 from public.communities where slug = 'naija-market')
  and exists (select 1 from public.sessions);

insert into public.communities
  (id, slug, name, description, emoji, is_public, owner_session_id, member_count, post_count)
select
  'space-gist-entertainment',
  'gist-entertainment',
  'Gist & Entertainment',
  'The gist no dey finish. Music, Nollywood, comedy, drama. Bring your hot takes.',
  '🎬',
  true,
  (select id from public.sessions order by created_at asc limit 1),
  0,
  0
where not exists (select 1 from public.communities where slug = 'gist-entertainment')
  and exists (select 1 from public.sessions);

insert into public.communities
  (id, slug, name, description, emoji, is_public, owner_session_id, member_count, post_count)
select
  'space-gamers-lounge',
  'gamers-lounge',
  'Gamers Lounge',
  'FIFA, COD, eSports, mobile. Squad up, no yawa.',
  '🎮',
  true,
  (select id from public.sessions order by created_at asc limit 1),
  0,
  0
where not exists (select 1 from public.communities where slug = 'gamers-lounge')
  and exists (select 1 from public.sessions);

insert into public.communities
  (id, slug, name, description, emoji, is_public, owner_session_id, member_count, post_count)
select
  'space-job-hustle',
  'job-hustle',
  'Job & Hustle',
  'Openings, side hustles, gig work. No gatekeeping. Post what you know.',
  '💼',
  true,
  (select id from public.sessions order by created_at asc limit 1),
  0,
  0
where not exists (select 1 from public.communities where slug = 'job-hustle')
  and exists (select 1 from public.sessions);

insert into public.communities
  (id, slug, name, description, emoji, is_public, owner_session_id, member_count, post_count)
select
  'space-food-kitchen',
  'food-kitchen',
  'Food & Kitchen',
  'Recipes, spots, plating. From mama''s pot to your kitchen.',
  '🍲',
  true,
  (select id from public.sessions order by created_at asc limit 1),
  0,
  0
where not exists (select 1 from public.communities where slug = 'food-kitchen')
  and exists (select 1 from public.sessions);

insert into public.communities
  (id, slug, name, description, emoji, is_public, owner_session_id, member_count, post_count)
select
  'space-love-life',
  'love-life',
  'Love & Life',
  'Real talk. Relationships, family, the things we don''t say out loud.',
  '💬',
  true,
  (select id from public.sessions order by created_at asc limit 1),
  0,
  0
where not exists (select 1 from public.communities where slug = 'love-life')
  and exists (select 1 from public.sessions);