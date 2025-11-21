-- Custom Authentication System
-- Replaces Supabase Auth with custom implementation

-- Update profiles table to work independently
-- Remove foreign key constraint to auth.users (if exists)
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add email and password_hash to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON profiles(email_verified);

-- Create sessions table for managing user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Enable RLS on sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- System can manage sessions (for login/logout)
CREATE POLICY "system can manage sessions" ON sessions
  FOR ALL USING (true);

-- Create email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for email_verifications
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Enable RLS on email_verifications
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Email verifications policies
CREATE POLICY "users can view own verifications" ON email_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "system can manage verifications" ON email_verifications
  FOR ALL USING (true);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for password_resets
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

-- Enable RLS on password_resets
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Password resets policies
CREATE POLICY "system can manage password resets" ON password_resets
  FOR ALL USING (true);

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$;

-- Function to clean expired email verifications
CREATE OR REPLACE FUNCTION clean_expired_email_verifications()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM email_verifications 
  WHERE expires_at < NOW() 
  AND verified_at IS NULL;
END;
$$;

-- Function to clean expired password resets
CREATE OR REPLACE FUNCTION clean_expired_password_resets()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM password_resets 
  WHERE expires_at < NOW() 
  AND used_at IS NULL;
END;
$$;

-- Update all foreign key references from auth.users to profiles
-- Note: This assumes profiles.id is now the primary user identifier

-- Update wagers table
ALTER TABLE wagers
  DROP CONSTRAINT IF EXISTS wagers_creator_id_fkey;

ALTER TABLE wagers
  ADD CONSTRAINT wagers_creator_id_fkey 
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update wager_entries table
ALTER TABLE wager_entries
  DROP CONSTRAINT IF EXISTS wager_entries_user_id_fkey;

ALTER TABLE wager_entries
  ADD CONSTRAINT wager_entries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update transactions table
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update notifications table
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update withdrawals table
ALTER TABLE withdrawals
  DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey;

ALTER TABLE withdrawals
  ADD CONSTRAINT withdrawals_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update user_preferences table
ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update push_subscriptions table
ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update custom_categories table
ALTER TABLE custom_categories
  DROP CONSTRAINT IF EXISTS custom_categories_created_by_fkey;

ALTER TABLE custom_categories
  ADD CONSTRAINT custom_categories_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update withdrawals approved_by
ALTER TABLE withdrawals
  DROP CONSTRAINT IF EXISTS withdrawals_approved_by_fkey;

ALTER TABLE withdrawals
  ADD CONSTRAINT withdrawals_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Note: RLS policies that reference auth.uid() will need to be updated
-- to use a custom function that gets the user_id from the session token
-- This will be handled in the application code

