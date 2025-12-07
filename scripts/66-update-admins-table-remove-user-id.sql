-- Update Admins Table - Remove user_id dependency
-- This makes admins completely independent from user profiles

-- ============================================================================
-- STEP 1: Drop Foreign Key Constraint
-- ============================================================================

-- Drop the foreign key constraint to profiles/users
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'admins' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%user%'
  ) LOOP
    BEGIN
      EXECUTE 'ALTER TABLE admins DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Add password_hash column if it doesn't exist
-- ============================================================================

ALTER TABLE admins ADD COLUMN IF NOT EXISTS password_hash text;

-- ============================================================================
-- STEP 3: Drop user_id column
-- ============================================================================

-- Drop unique constraint on user_id first if it exists
ALTER TABLE admins DROP CONSTRAINT IF EXISTS UQ_2b901dd818a2a6486994d915a68;
ALTER TABLE admins DROP CONSTRAINT IF EXISTS "UQ_2b901dd818a2a6486994d915a68";

-- Drop index on user_id if it exists
DROP INDEX IF EXISTS idx_admins_user_id;

-- Drop the user_id column
ALTER TABLE admins DROP COLUMN IF EXISTS user_id;

-- ============================================================================
-- STEP 4: Update Helper Functions
-- ============================================================================

-- Update is_user_admin function to check by email instead
CREATE OR REPLACE FUNCTION is_user_admin(user_email text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  admin_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM admins 
    WHERE email = user_email
    AND is_active = true
  ) INTO admin_exists;
  
  RETURN COALESCE(admin_exists, false);
END;
$$;

-- Remove get_admin_by_user_id function (no longer needed)
DROP FUNCTION IF EXISTS get_admin_by_user_id(uuid);

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Admins are now completely independent from user profiles
-- 2. Admins have their own email, username, and password_hash
-- 3. If you need to link an admin to a user later, you can add a user_id column
--    and create the relationship at that time
-- 4. The platform_settings.updated_by still references admins.id (unchanged)

