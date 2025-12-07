-- Create Admins Table
-- Separate table for managing platform administrators
-- This allows better separation of concerns and admin-specific features

-- ============================================================================
-- STEP 1: Create Admins Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  username text,
  full_name text,
  password_hash text,
  role text DEFAULT 'admin', -- e.g., 'super_admin', 'admin', 'moderator'
  is_active boolean DEFAULT true,
  permissions text[] DEFAULT ARRAY[]::text[],
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login_at timestamptz
);

-- ============================================================================
-- STEP 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- ============================================================================
-- STEP 3: Migrate Existing Admins
-- ============================================================================

-- Migrate users with is_admin = true to admins table
INSERT INTO admins (user_id, email, username, full_name, role, is_active, created_at, updated_at)
SELECT 
  id,
  email,
  username,
  COALESCE(full_name, NULL) as full_name,
  'admin' as role,
  COALESCE(is_suspended, false) = false as is_active,
  created_at,
  updated_at
FROM profiles
WHERE is_admin = true
  AND NOT EXISTS (
    SELECT 1 FROM admins WHERE admins.user_id = profiles.id
  );

-- ============================================================================
-- STEP 4: Update Platform Settings Foreign Key
-- ============================================================================

-- Drop the old foreign key constraint if it exists (may have different names)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Try to drop constraint with different possible names
  ALTER TABLE platform_settings DROP CONSTRAINT IF EXISTS platform_settings_updated_by_fkey;
  ALTER TABLE platform_settings DROP CONSTRAINT IF EXISTS FK_62e70f824fccd12d37b7fe11b01;
  
  -- Also try to drop any constraint on updated_by column
  FOR r IN (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'platform_settings' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%updated_by%'
  ) LOOP
    EXECUTE 'ALTER TABLE platform_settings DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- First, we need to update existing updated_by values to reference admin IDs
-- For existing settings with updated_by pointing to profiles (user_id), we need to find the corresponding admin
-- Store the mapping temporarily
DO $$
DECLARE
  setting_record RECORD;
  admin_id_val uuid;
BEGIN
  FOR setting_record IN 
    SELECT id, updated_by FROM platform_settings WHERE updated_by IS NOT NULL
  LOOP
    -- Try to find admin by user_id (if updated_by was a profile id)
    SELECT a.id INTO admin_id_val
    FROM admins a
    WHERE a.user_id = setting_record.updated_by;
    
    IF admin_id_val IS NOT NULL THEN
      -- Update to use admin id
      UPDATE platform_settings
      SET updated_by = admin_id_val
      WHERE id = setting_record.id;
    ELSE
      -- If no admin found, set to NULL (or keep existing if it's already an admin id)
      -- Check if it's already a valid admin id
      IF NOT EXISTS (SELECT 1 FROM admins WHERE id = setting_record.updated_by) THEN
        UPDATE platform_settings
        SET updated_by = NULL
        WHERE id = setting_record.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Add new foreign key to reference admins table
ALTER TABLE platform_settings
  ADD CONSTRAINT platform_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 5: Create Helper Functions
-- ============================================================================

-- Function to check if an email belongs to an admin
CREATE OR REPLACE FUNCTION is_admin_email(email_param text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  admin_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM admins 
    WHERE email = email_param 
    AND is_active = true
  ) INTO admin_exists;
  
  RETURN COALESCE(admin_exists, false);
END;
$$;

-- ============================================================================
-- STEP 6: Create RLS Policies (if needed)
-- ============================================================================

-- Note: Admins table should be accessible only by admins themselves or super admins
-- This will be handled at the application level for now

-- ============================================================================
-- STEP 7: Create Trigger to Update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_admins_updated_at_trigger ON admins;
CREATE TRIGGER update_admins_updated_at_trigger
  BEFORE UPDATE ON admins
  FOR EACH ROW
  EXECUTE FUNCTION update_admins_updated_at();

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Admins are completely independent from user profiles
-- 2. Admins have their own email, username, password_hash, and authentication
-- 3. The platform_settings.updated_by references admins.id
-- 4. If you need to link an admin to a user profile later, you can add a user_id column

