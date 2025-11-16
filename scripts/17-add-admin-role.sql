-- Add admin role to profiles table
-- Simple admin system - just a boolean flag

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Admin can view all profiles
CREATE POLICY "admin can view all profiles" ON profiles
  FOR SELECT USING (is_admin = true OR auth.uid() = id);

-- Admin can update any profile
CREATE POLICY "admin can update all profiles" ON profiles
  FOR UPDATE USING (
    auth.uid() = id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can view all wagers
CREATE POLICY "admin can view all wagers" ON wagers
  FOR SELECT USING (
    is_public = true 
    OR auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can update any wager
CREATE POLICY "admin can update all wagers" ON wagers
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can view all transactions
CREATE POLICY "admin can view all transactions" ON transactions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can view all wager entries
CREATE POLICY "admin can view all entries" ON wager_entries
  FOR SELECT USING (
    true
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id_param uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  admin_status boolean;
BEGIN
  SELECT COALESCE(is_admin, false) INTO admin_status
  FROM profiles
  WHERE id = user_id_param;
  RETURN COALESCE(admin_status, false);
END; $$;

