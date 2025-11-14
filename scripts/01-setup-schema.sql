-- Create profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  balance numeric default 0,
  created_at timestamptz default now()
);

-- Create wagers table
create table wagers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  amount numeric not null,
  side_a text not null,
  side_b text not null,
  deadline timestamptz,
  status text default 'OPEN',
  winning_side text,
  fee_percentage numeric default 0.01,
  created_at timestamptz default now()
);

-- Create wager_entries table
create table wager_entries (
  id uuid primary key default gen_random_uuid(),
  wager_id uuid not null references wagers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null,
  amount numeric not null,
  created_at timestamptz default now()
);

-- Create transactions table
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  amount numeric not null,
  reference text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table wagers enable row level security;
alter table wager_entries enable row level security;
alter table transactions enable row level security;

-- Profiles policies
create policy "allow read own" on profiles for select using (auth.uid() = id);
create policy "allow update own" on profiles for update using (auth.uid() = id);
create policy "allow insert" on profiles for insert with check (auth.uid() = id);

-- Wagers policies (public read, creator can create/update)
create policy "public read" on wagers for select using (true);
create policy "creator insert" on wagers for insert with check (auth.uid() = creator_id or creator_id is null);
create policy "creator update" on wagers for update using (auth.uid() = creator_id or creator_id is null);

-- Wager entries policies
create policy "public view" on wager_entries for select using (true);
create policy "user insert" on wager_entries for insert with check (auth.uid() = user_id);

-- Transactions policies
create policy "user view own" on transactions for select using (auth.uid() = user_id);
create policy "user insert" on transactions for insert with check (auth.uid() = user_id);

-- Create increment_balance RPC function
create or replace function increment_balance(user_id uuid, amt numeric)
returns void language plpgsql as $$
begin
  update profiles set balance = balance + amt where id = user_id;
end; $$;

-- Seed some system wagers
insert into wagers (title, description, amount, side_a, side_b, deadline, status, fee_percentage)
values 
  ('Will it rain tomorrow?', 'Bet on whether it will rain in your city', 100, 'Yes', 'No', now() + interval '1 day', 'OPEN', 0.01),
  ('Bitcoin over $50k by month end?', 'Cryptocurrency price prediction', 500, 'Yes', 'No', now() + interval '15 days', 'OPEN', 0.01),
  ('Who wins the playoff game?', 'Sports prediction for upcoming game', 250, 'Team A', 'Team B', now() + interval '3 days', 'OPEN', 0.01);
