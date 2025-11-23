-- Fix wager_comments foreign key to reference profiles(id) instead of auth.users(id)
-- This is needed because the system uses custom authentication

-- Step 1: Drop existing foreign key constraint (if it exists)
ALTER TABLE wager_comments 
  DROP CONSTRAINT IF EXISTS wager_comments_user_id_fkey;

ALTER TABLE wager_comments 
  DROP CONSTRAINT IF EXISTS wager_comments_user_id_key;

-- Step 2: Drop all constraints related to user_id
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'wager_comments'::regclass
    AND (
      conname LIKE '%user_id%' 
      OR conname = 'wager_comments_user_id_key'
      OR conname = 'wager_comments_user_id_fkey'
    )
  LOOP
    EXECUTE 'ALTER TABLE wager_comments DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.conname);
    RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
  END LOOP;
END $$;

-- Step 3: Create correct foreign key to profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'wager_comments'::regclass
    AND conname LIKE '%user_id%'
    AND contype = 'f'
  ) THEN
    ALTER TABLE wager_comments 
    ADD CONSTRAINT wager_comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Created foreign key constraint: wager_comments_user_id_fkey -> profiles(id)';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Step 4: Also fix wager_activities if needed
ALTER TABLE wager_activities 
  DROP CONSTRAINT IF EXISTS wager_activities_user_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'wager_activities'::regclass
    AND conname LIKE '%user_id%'
    AND contype = 'f'
  ) THEN
    ALTER TABLE wager_activities 
    ADD CONSTRAINT wager_activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Created foreign key constraint: wager_activities_user_id_fkey -> profiles(id)';
  END IF;
END $$;

-- Step 5: Verify constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid IN ('wager_comments'::regclass, 'wager_activities'::regclass)
AND conname LIKE '%user_id%'
ORDER BY conrelid::text, conname;

