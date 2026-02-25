-- Sessions table (each tasting event)
create table sessions (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  name text not null,
  beer_count integer not null default 13,
  admin_password text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Beer reveals (admin only - maps number to actual beer name)
create table beer_reveals (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  beer_number integer not null,
  beer_name text not null,
  brewery text,
  style text,
  created_at timestamp with time zone default now(),
  unique(session_id, beer_number)
);

-- Players who joined a session
create table players (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  name text not null,
  order_direction text not null default 'ascending',
  created_at timestamp with time zone default now()
);

-- Individual beer ratings
create table ratings (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  beer_number integer not null,
  crushability integer check (crushability between 1 and 10),
  taste integer check (taste between 1 and 10),
  guess text,
  notes text,
  created_at timestamp with time zone default now(),
  unique(player_id, beer_number)
);

alter table sessions enable row level security;
alter table beer_reveals enable row level security;
alter table players enable row level security;
alter table ratings enable row level security;

create policy "Anyone can read active sessions" on sessions for select using (is_active = true);
create policy "Anyone can create sessions" on sessions for insert with check (true);
create policy "Anyone can read reveals" on beer_reveals for select using (true);
create policy "Anyone can insert reveals" on beer_reveals for insert with check (true);
create policy "Anyone can update reveals" on beer_reveals for update using (true);
create policy "Anyone can read players" on players for select using (true);
create policy "Anyone can join as player" on players for insert with check (true);
create policy "Anyone can read ratings" on ratings for select using (true);
create policy "Anyone can submit ratings" on ratings for insert with check (true);
create policy "Anyone can update ratings" on ratings for update using (true);
