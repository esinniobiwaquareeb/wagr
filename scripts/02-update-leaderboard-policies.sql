-- Update RLS policies to allow public read of profiles for leaderboard
-- This allows anyone to view username and balance for leaderboard purposes

-- Drop existing restrictive policy
drop policy if exists "allow read own" on profiles;

-- Create new policy that allows public read of username and balance
create policy "public read leaderboard" on profiles 
  for select 
  using (true);

-- Note: Users can still only update their own profiles due to existing policy

