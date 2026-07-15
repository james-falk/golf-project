-- East Coast Big Playas: production data model.
-- Score data is stored per player/team and per hole so separate scorekeepers do
-- not overwrite one another's cards.

create table tournaments (
  id uuid primary key,
  name text not null,
  year integer not null,
  viewer_code_hash text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('commissioner', 'helper')),
  access_code_hash text not null,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table course_holes (
  course_id uuid not null references courses(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  par smallint not null check (par between 3 and 6),
  stroke_index smallint check (stroke_index between 1 and 18),
  primary key (course_id, hole_number)
);

create table players (
  id uuid primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  nickname text,
  tier text not null check (tier in ('A', 'B', 'C', 'D')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table rounds (
  id uuid primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  day text not null check (day in ('thursday', 'friday', 'saturday')),
  kind text not null check (kind in ('skins', 'scramble')),
  course_id uuid not null references courses(id),
  entry_fee_cents integer not null check (entry_fee_cents >= 0),
  status text not null default 'setup' check (status in ('setup', 'live', 'locked')),
  unique (tournament_id, day, kind)
);

create table round_players (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (round_id, player_id)
);

create table playing_groups (
  id uuid primary key,
  round_id uuid not null references rounds(id) on delete cascade,
  name text not null,
  scorekeeper_user_id uuid references users(id)
);

create table playing_group_members (
  playing_group_id uuid not null references playing_groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (playing_group_id, player_id)
);

create table player_hole_scores (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  strokes smallint not null check (strokes between 1 and 20),
  entered_by_user_id uuid references users(id),
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id, hole_number)
);

create table scorecard_checks (
  round_id uuid not null references rounds(id) on delete cascade,
  owner_id uuid not null,
  entered_total smallint not null check (entered_total between 1 and 200),
  reviewed_by_user_id uuid references users(id),
  reviewed_at timestamptz,
  primary key (round_id, owner_id)
);

create table closest_to_pin_winners (
  round_id uuid not null references rounds(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  player_id uuid not null references players(id),
  entered_by_user_id uuid references users(id),
  primary key (round_id, hole_number)
);

create table scramble_teams (
  id uuid primary key,
  round_id uuid not null references rounds(id) on delete cascade,
  name text not null,
  unique (round_id, name)
);

create table scramble_team_members (
  team_id uuid not null references scramble_teams(id) on delete cascade,
  player_id uuid not null references players(id),
  primary key (team_id, player_id)
);

create table scramble_hole_scores (
  round_id uuid not null references rounds(id) on delete cascade,
  team_id uuid not null references scramble_teams(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  strokes smallint not null check (strokes between 1 and 20),
  entered_by_user_id uuid references users(id),
  updated_at timestamptz not null default now(),
  primary key (round_id, team_id, hole_number)
);

create table audit_log (
  id uuid primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
