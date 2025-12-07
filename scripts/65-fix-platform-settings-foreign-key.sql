-- Fix Platform Settings Foreign Key
-- This script should be run AFTER 64-create-admins-table.sql
-- It updates the platform_settings.updated_by to reference admins.id instead of profiles.id

-- ============================================================================
-- STEP 1: Drop Old Foreign Key Constraints
-- ============================================================================

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
    BEGIN
      EXECUTE 'ALTER TABLE platform_settings DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    EXCEPTION
      WHEN OTHERS THEN
        -- Ignore errors if constraint doesn't exist
        NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Update Existing updated_by Values
-- ============================================================================

-- Convert existing updated_by values from profile IDs to admin IDs
-- For settings that have updated_by pointing to a profile, find the corresponding admin
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
    WHERE a.user_id = setting_record.updated_by
      AND a.is_active = true;
    
    IF admin_id_val IS NOT NULL THEN
      -- Update to use admin id
      UPDATE platform_settings
      SET updated_by = admin_id_val
      WHERE id = setting_record.id;
    ELSE
      -- Check if it's already a valid admin id
      IF NOT EXISTS (SELECT 1 FROM admins WHERE id = setting_record.updated_by AND is_active = true) THEN
        -- If not found, set to NULL
        UPDATE platform_settings
        SET updated_by = NULL
        WHERE id = setting_record.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Add New Foreign Key Constraint
-- ============================================================================

-- Add new foreign key to reference admins table
ALTER TABLE platform_settings
  ADD CONSTRAINT platform_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- After running this script:
-- 1. platform_settings.updated_by now references admins.id
-- 2. When importing platform_settings data, set updated_by to NULL initially
--    or ensure the admin exists in the admins table first
-- 3. The application should update updated_by with the current admin's ID when modifying settings

