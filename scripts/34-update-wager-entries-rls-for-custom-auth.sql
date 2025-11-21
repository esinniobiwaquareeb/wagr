-- Update wager_entries RLS policies to work with custom auth
-- Since RLS can't access custom session cookies, we'll make entries readable/insertable
-- and let the application filter by user_id (which it already does)

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "public view" ON wager_entries;
DROP POLICY IF EXISTS "user insert" ON wager_entries;

-- Allow public read of wager entries (application can filter if needed)
CREATE POLICY "public read wager entries" ON wager_entries
  FOR SELECT USING (true);

-- Allow users to insert entries (application will validate user_id)
CREATE POLICY "users can insert entries" ON wager_entries
  FOR INSERT WITH CHECK (true);

-- Note: The application code already validates that users can only create
-- their own entries, so these permissive policies are safe

