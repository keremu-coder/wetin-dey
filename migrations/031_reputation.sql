-- Migration 031: reputation schema (Batch 11).
--
-- Adds the data structure for the three-path reputation system
-- described in the positioning doc. This migration is intentionally
-- NON-DESTRUCTIVE and NON-BEHAVIOURAL: it only adds columns.
--
-- Nothing reads these columns yet. The scoring logic that bumps them
-- lives in Batch 12 (post-launch), after we've watched how the
-- community behaves for 4-6 weeks. The reason to add the schema now
-- rather than post-launch: if we ever need to backfill or migrate an
-- existing user's score, the column must exist first.
--
-- Design decisions (see conversation for full reasoning):
--   * Base tier is "neighbour" and is DIGNIFIED — the empty-shield
--     problem was explicitly rejected. Every session starts at
--     'neighbour', which is a real rank, not a placeholder.
--   * Three orthogonal paths (reporter / helper / community), each
--     with two levels. A user can advance on any path independently.
--     None outranks another — a Chronicler and an Anchor are equals.
--   * Display is opt-in (tier_display_enabled, default false). This
--     kills the discrimination problem at the root: no public
--     hierarchy exists unless the user chooses one.
--   * Moderation power is NOT tied to tier. Flag weight comes from
--     accuracy rate, computed quietly, never shown. No "marshal"
--     exists, no single account is worth capturing.

alter table public.sessions
  add column if not exists reputation_tier text not null default 'neighbour'
    check (reputation_tier in (
      'neighbour',
      'witness', 'chronicler',
      'helper', 'pillar',
      'host', 'anchor'
    ));

alter table public.sessions
  add column if not exists reputation_points int not null default 0;

-- Reporter path tracking
alter table public.sessions
  add column if not exists reporter_approved_count int not null default 0;
alter table public.sessions
  add column if not exists reporter_strike_count int not null default 0;

-- Helper path tracking
alter table public.sessions
  add column if not exists helper_accepted_count int not null default 0;

-- Community path tracking
-- top_space_members is denormalised: the member count of the largest
-- space this session owns. Recomputed on join/leave events in Batch 12.
-- Storing it here avoids a JOIN on every tier computation.
alter table public.sessions
  add column if not exists community_top_space_members int not null default 0;
alter table public.sessions
  add column if not exists community_spaces_qualified int not null default 0;

-- Opt-in display flag. Default false so no user is publicly ranked
-- until they choose to be. This is the rule that kills the
-- "Nigerian status hierarchy on a status-free platform" problem.
alter table public.sessions
  add column if not exists tier_display_enabled boolean not null default false;

create index if not exists sessions_reputation_tier_idx
  on public.sessions (reputation_tier)
  where tier_display_enabled = true;

comment on column public.sessions.reputation_tier is
  'Neighbour (base) | Witness/Chronicler (reporter path) | Helper/Pillar (helper path) | Host/Anchor (community path). See lib/reputation.ts for thresholds.';
comment on column public.sessions.tier_display_enabled is
  'If false (default), the tier is not rendered anywhere. Users must opt in to public ranking.';
