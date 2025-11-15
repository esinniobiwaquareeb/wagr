-- Allow creators to delete their wagers
-- This adds RLS policy for wager deletion

-- Add delete policy for wagers (creators can delete their own wagers)
CREATE POLICY "creator delete" ON wagers
  FOR DELETE USING (auth.uid() = creator_id);

