-- Add soft delete functionality for users
-- This allows users to be marked as deleted without actually removing their data

-- Add deleted_at column to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for faster queries filtering out deleted users
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.deleted_at IS 'Timestamp when user account was soft deleted. NULL means account is active.';

