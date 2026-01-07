-- Add metadata field to daily_challenges table to track contributing wager IDs
-- This prevents users from claiming rewards and then deleting/unjoining wagers

-- Add metadata column to store wager IDs that contributed to challenge completion
ALTER TABLE daily_challenges
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on metadata for efficient queries
CREATE INDEX IF NOT EXISTS idx_daily_challenges_metadata_wager_ids 
ON daily_challenges USING GIN ((metadata->'wager_ids'));

-- Add comment explaining the metadata structure
COMMENT ON COLUMN daily_challenges.metadata IS 'Stores metadata about the challenge, including wager_ids array that tracks which wagers contributed to challenge completion';

