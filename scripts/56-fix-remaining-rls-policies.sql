-- Fix remaining RLS policies that use auth.uid() for custom auth
-- This script updates all remaining policies to work with custom authentication

-- ============================================================================
-- KYC Submissions
-- ============================================================================
DROP POLICY IF EXISTS "users view own kyc submissions" ON kyc_submissions;
DROP POLICY IF EXISTS "users insert kyc submissions" ON kyc_submissions;
DROP POLICY IF EXISTS "admins update kyc submissions" ON kyc_submissions;

-- Allow users to view all kyc submissions (application will filter by user_id)
CREATE POLICY "users can view kyc submissions" ON kyc_submissions
  FOR SELECT USING (true);

-- Allow users to insert kyc submissions (application will validate user_id)
CREATE POLICY "users can insert kyc submissions" ON kyc_submissions
  FOR INSERT WITH CHECK (true);

-- Allow updates (application will validate admin status)
CREATE POLICY "users can update kyc submissions" ON kyc_submissions
  FOR UPDATE USING (true);

-- ============================================================================
-- Bill Payments
-- ============================================================================
DROP POLICY IF EXISTS "users can view their bill payments" ON bill_payments;

-- Allow users to view all bill payments (application will filter by user_id)
CREATE POLICY "users can view bill payments" ON bill_payments
  FOR SELECT USING (true);

-- Allow users to insert bill payments (application will validate user_id)
CREATE POLICY "users can insert bill payments" ON bill_payments
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- Push Subscriptions (if table exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
    DROP POLICY IF EXISTS "users can view own push subscriptions" ON push_subscriptions;
    DROP POLICY IF EXISTS "users can insert push subscriptions" ON push_subscriptions;
    DROP POLICY IF EXISTS "users can update push subscriptions" ON push_subscriptions;
    DROP POLICY IF EXISTS "users can delete push subscriptions" ON push_subscriptions;

    CREATE POLICY "users can view push subscriptions" ON push_subscriptions
      FOR SELECT USING (true);

    CREATE POLICY "users can insert push subscriptions" ON push_subscriptions
      FOR INSERT WITH CHECK (true);

    CREATE POLICY "users can update push subscriptions" ON push_subscriptions
      FOR UPDATE USING (true);

    CREATE POLICY "users can delete push subscriptions" ON push_subscriptions
      FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================================================
-- Teams (if still using auth.uid())
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teams') THEN
    -- Drop existing team policies and recreate permissive ones
    DROP POLICY IF EXISTS "Users can view their own teams" ON teams;
    DROP POLICY IF EXISTS "Users can create their own teams" ON teams;
    DROP POLICY IF EXISTS "Users can update their own teams" ON teams;
    DROP POLICY IF EXISTS "Users can delete their own teams" ON teams;

    CREATE POLICY "users can view teams" ON teams
      FOR SELECT USING (true);

    CREATE POLICY "users can create teams" ON teams
      FOR INSERT WITH CHECK (true);

    CREATE POLICY "users can update teams" ON teams
      FOR UPDATE USING (true);

    CREATE POLICY "users can delete teams" ON teams
      FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================================================
-- Platform Settings (if still using auth.uid())
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'platform_settings') THEN
    -- Drop existing policies and recreate permissive ones
    DROP POLICY IF EXISTS "admins can view settings" ON platform_settings;
    DROP POLICY IF EXISTS "admins can update settings" ON platform_settings;
    DROP POLICY IF EXISTS "users can view settings" ON platform_settings;
    DROP POLICY IF EXISTS "users can update settings" ON platform_settings;

    -- Create permissive policies (application validates admin status)
    CREATE POLICY "users can view settings" ON platform_settings
      FOR SELECT USING (true);

    CREATE POLICY "users can update settings" ON platform_settings
      FOR UPDATE USING (true);
  END IF;
END $$;

-- ============================================================================
-- Verification: List all tables with RLS enabled
-- ============================================================================
-- Run this query to verify all RLS policies are updated:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND qual LIKE '%auth.uid()%'
-- ORDER BY tablename, policyname;

