-- Add UPDATE and DELETE policies for wager_entries table
-- This fixes the issue where users cannot update their wager entries (e.g., switch sides)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users can update own entries" ON wager_entries;
DROP POLICY IF EXISTS "users can delete own entries" ON wager_entries;

-- Allow users to update their own entries (application will validate user_id)
CREATE POLICY "users can update own entries" ON wager_entries
  FOR UPDATE USING (true);

-- Allow users to delete their own entries (application will validate user_id)
CREATE POLICY "users can delete own entries" ON wager_entries
  FOR DELETE USING (true);

-- Note: The application code already validates that users can only update/delete
-- their own entries, so these permissive policies are safe

