-- Add visibility field to wagers table
-- This allows users to create private wagers that only they can see

ALTER TABLE wagers ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Update existing wagers to be public by default
UPDATE wagers SET is_public = true WHERE is_public IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_wagers_is_public ON wagers(is_public);

-- Update RLS policies to respect visibility
-- Users can see public wagers or their own private wagers
DROP POLICY IF EXISTS "public read" ON wagers;
CREATE POLICY "public read wagers" ON wagers 
  FOR SELECT 
  USING (
    is_public = true 
    OR auth.uid() = creator_id
  );

-- Users can only create public wagers or private wagers for themselves
DROP POLICY IF EXISTS "creator insert" ON wagers;
CREATE POLICY "creator insert wagers" ON wagers 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = creator_id 
    AND (
      is_public = true 
      OR auth.uid() = creator_id
    )
  );

