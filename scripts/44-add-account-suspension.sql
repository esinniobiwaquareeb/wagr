-- Add account suspension functionality
-- Allows admins to suspend user accounts

-- Add is_suspended field to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

-- Add suspended_at timestamp for tracking when account was suspended
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Add suspension_reason for admin notes
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Create index for faster lookups of suspended users
CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended ON profiles(is_suspended);

-- Add comment for documentation
COMMENT ON COLUMN profiles.is_suspended IS 'Indicates if the user account is suspended';
COMMENT ON COLUMN profiles.suspended_at IS 'Timestamp when the account was suspended';
COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for suspension (admin notes)';

