-- Platform Settings Management System
-- This creates a comprehensive settings table for super admins to control all aspects of the platform

-- ============================================================================
-- STEP 1: Create Settings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL CHECK (data_type IN ('boolean', 'number', 'string', 'json', 'array')),
  is_public BOOLEAN DEFAULT false, -- If true, can be accessed by non-admin users
  requires_restart BOOLEAN DEFAULT false, -- If true, requires app restart to take effect
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- ============================================================================
-- STEP 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);
CREATE INDEX IF NOT EXISTS idx_platform_settings_is_public ON platform_settings(is_public);

-- ============================================================================
-- STEP 3: Create RLS Policies
-- ============================================================================

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read all settings
CREATE POLICY "admins can read all settings" ON platform_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Public users can only read public settings
CREATE POLICY "public users can read public settings" ON platform_settings
  FOR SELECT
  USING (is_public = true);

-- Only admins can insert/update/delete
CREATE POLICY "admins can manage settings" ON platform_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- STEP 4: Create Helper Functions
-- ============================================================================

-- Function to get a setting value
CREATE OR REPLACE FUNCTION get_setting(setting_key TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  setting_value JSONB;
BEGIN
  SELECT value INTO setting_value
  FROM platform_settings
  WHERE key = setting_key;
  
  RETURN setting_value;
END;
$$;

-- Function to set a setting value
CREATE OR REPLACE FUNCTION set_setting(
  setting_key TEXT,
  setting_value JSONB,
  setting_category TEXT DEFAULT 'general',
  setting_label TEXT DEFAULT NULL,
  setting_description TEXT DEFAULT NULL,
  setting_data_type TEXT DEFAULT 'string',
  setting_is_public BOOLEAN DEFAULT false,
  setting_requires_restart BOOLEAN DEFAULT false,
  updated_by_user_id UUID DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO platform_settings (
    key, value, category, label, description, data_type, is_public, requires_restart, updated_by
  )
  VALUES (
    setting_key, setting_value, setting_category, 
    COALESCE(setting_label, setting_key), 
    setting_description, setting_data_type, setting_is_public, 
    setting_requires_restart, updated_by_user_id
  )
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    category = EXCLUDED.category,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    data_type = EXCLUDED.data_type,
    is_public = EXCLUDED.is_public,
    requires_restart = EXCLUDED.requires_restart,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

-- ============================================================================
-- STEP 5: Insert Default Settings
-- ============================================================================

-- Payment Settings
SELECT set_setting('payments.enabled', 'true'::jsonb, 'payments', 'Enable Payments', 'Allow users to deposit and withdraw funds', 'boolean', false, false);
SELECT set_setting('payments.deposits_enabled', 'true'::jsonb, 'payments', 'Enable Deposits', 'Allow users to deposit funds', 'boolean', false, false);
SELECT set_setting('payments.withdrawals_enabled', 'true'::jsonb, 'payments', 'Enable Withdrawals', 'Allow users to withdraw funds', 'boolean', false, false);
SELECT set_setting('payments.min_deposit', '100'::jsonb, 'payments', 'Minimum Deposit', 'Minimum amount users can deposit (in NGN)', 'number', true, false);
SELECT set_setting('payments.max_deposit', '10000000'::jsonb, 'payments', 'Maximum Deposit', 'Maximum amount users can deposit (in NGN)', 'number', true, false);
SELECT set_setting('payments.min_withdrawal', '100'::jsonb, 'payments', 'Minimum Withdrawal', 'Minimum amount users can withdraw (in NGN)', 'number', true, false);
SELECT set_setting('payments.max_withdrawal', '1000000'::jsonb, 'payments', 'Maximum Withdrawal', 'Maximum amount users can withdraw (in NGN)', 'number', true, false);
SELECT set_setting('payments.daily_withdrawal_limit', '500000'::jsonb, 'payments', 'Daily Withdrawal Limit', 'Maximum amount a user can withdraw per day (in NGN)', 'number', true, false);
SELECT set_setting('payments.monthly_withdrawal_limit', '5000000'::jsonb, 'payments', 'Monthly Withdrawal Limit', 'Maximum amount a user can withdraw per month (in NGN)', 'number', true, false);
SELECT set_setting('payments.withdrawal_requires_approval', 'false'::jsonb, 'payments', 'Require Withdrawal Approval', 'Require admin approval for all withdrawals', 'boolean', false, false);
SELECT set_setting('payments.paystack_public_key', '"pk_test_xxxxx"'::jsonb, 'payments', 'Paystack Public Key', 'Paystack public API key', 'string', false, true);
SELECT set_setting('payments.paystack_secret_key', '"sk_test_xxxxx"'::jsonb, 'payments', 'Paystack Secret Key', 'Paystack secret API key', 'string', false, true);

-- Commission & Fee Settings
SELECT set_setting('fees.wager_platform_fee_percentage', '0.05'::jsonb, 'fees', 'Wager Platform Fee', 'Platform fee percentage for wagers (e.g., 0.05 = 5%)', 'number', true, false);
SELECT set_setting('fees.quiz_platform_fee_percentage', '0.10'::jsonb, 'fees', 'Quiz Platform Fee', 'Platform fee percentage for quizzes (e.g., 0.10 = 10%)', 'number', true, false);
SELECT set_setting('fees.default_wager_fee_percentage', '0.05'::jsonb, 'fees', 'Default Wager Fee', 'Default fee percentage for new wagers', 'number', false, false);

-- Feature Flags
SELECT set_setting('features.wagers_enabled', 'true'::jsonb, 'features', 'Enable Wagers', 'Allow users to create and join wagers', 'boolean', true, false);
SELECT set_setting('features.quizzes_enabled', 'true'::jsonb, 'features', 'Enable Quizzes', 'Allow users to create and participate in quizzes', 'boolean', true, false);
SELECT set_setting('features.system_wagers_enabled', 'true'::jsonb, 'features', 'Enable System Wagers', 'Enable automated system-generated wagers', 'boolean', true, true);
SELECT set_setting('features.withdrawals_enabled', 'true'::jsonb, 'features', 'Enable Withdrawals', 'Allow users to withdraw funds', 'boolean', true, false);
SELECT set_setting('features.deposits_enabled', 'true'::jsonb, 'features', 'Enable Deposits', 'Allow users to deposit funds', 'boolean', true, false);
SELECT set_setting('features.email_notifications_enabled', 'true'::jsonb, 'features', 'Enable Email Notifications', 'Send email notifications to users', 'boolean', false, false);
SELECT set_setting('features.push_notifications_enabled', 'true'::jsonb, 'features', 'Enable Push Notifications', 'Enable browser push notifications', 'boolean', true, false);
SELECT set_setting('features.wager_deletion_enabled', 'true'::jsonb, 'features', 'Allow Wager Deletion', 'Allow wager creators to delete their wagers', 'boolean', true, false);
SELECT set_setting('features.quiz_deletion_enabled', 'true'::jsonb, 'features', 'Allow Quiz Deletion', 'Allow quiz creators to delete their quizzes (draft only)', 'boolean', true, false);

-- Wager Settings
SELECT set_setting('wagers.default_amount', '500'::jsonb, 'wagers', 'Default Wager Amount', 'Default amount for new wagers (in NGN)', 'number', true, false);
SELECT set_setting('wagers.min_amount', '100'::jsonb, 'wagers', 'Minimum Wager Amount', 'Minimum amount for wagers (in NGN)', 'number', true, false);
SELECT set_setting('wagers.max_amount', '1000000'::jsonb, 'wagers', 'Maximum Wager Amount', 'Maximum amount for wagers (in NGN)', 'number', true, false);
SELECT set_setting('wagers.default_deadline_days', '7'::jsonb, 'wagers', 'Default Deadline Days', 'Default number of days for wager deadline', 'number', true, false);
SELECT set_setting('wagers.min_deadline_days', '1'::jsonb, 'wagers', 'Minimum Deadline Days', 'Minimum number of days for wager deadline', 'number', true, false);
SELECT set_setting('wagers.max_deadline_days', '30'::jsonb, 'wagers', 'Maximum Deadline Days', 'Maximum number of days for wager deadline', 'number', true, false);
SELECT set_setting('wagers.max_title_length', '200'::jsonb, 'wagers', 'Max Title Length', 'Maximum characters for wager title', 'number', true, false);
SELECT set_setting('wagers.max_description_length', '1000'::jsonb, 'wagers', 'Max Description Length', 'Maximum characters for wager description', 'number', true, false);
SELECT set_setting('wagers.max_side_length', '100'::jsonb, 'wagers', 'Max Side Length', 'Maximum characters for wager side text', 'number', true, false);

-- Quiz Settings
SELECT set_setting('quizzes.default_entry_fee', '100'::jsonb, 'quizzes', 'Default Entry Fee', 'Default entry fee per question for quizzes (in NGN)', 'number', true, false);
SELECT set_setting('quizzes.min_participants', '2'::jsonb, 'quizzes', 'Minimum Participants', 'Minimum number of participants for a quiz', 'number', true, false);
SELECT set_setting('quizzes.max_participants', '1000'::jsonb, 'quizzes', 'Maximum Participants', 'Maximum number of participants for a quiz', 'number', true, false);
SELECT set_setting('quizzes.min_questions', '1'::jsonb, 'quizzes', 'Minimum Questions', 'Minimum number of questions in a quiz', 'number', true, false);
SELECT set_setting('quizzes.max_questions', '100'::jsonb, 'quizzes', 'Maximum Questions', 'Maximum number of questions in a quiz', 'number', true, false);
SELECT set_setting('quizzes.default_duration_minutes', '30'::jsonb, 'quizzes', 'Default Duration', 'Default quiz duration in minutes', 'number', true, false);
SELECT set_setting('quizzes.auto_settle_enabled', 'true'::jsonb, 'quizzes', 'Auto Settle Quizzes', 'Automatically settle quizzes after deadline', 'boolean', false, false);

-- Account & Security Settings
SELECT set_setting('security.min_password_length', '8'::jsonb, 'security', 'Minimum Password Length', 'Minimum characters required for passwords', 'number', true, false);
SELECT set_setting('security.require_2fa', 'false'::jsonb, 'security', 'Require 2FA', 'Require two-factor authentication for all users', 'boolean', false, false);
SELECT set_setting('security.account_suspension_enabled', 'true'::jsonb, 'security', 'Enable Account Suspension', 'Allow admins to suspend user accounts', 'boolean', false, false);
SELECT set_setting('security.rate_limit_api_requests', '100'::jsonb, 'security', 'API Rate Limit', 'Maximum API requests per minute per user', 'number', false, false);
SELECT set_setting('security.rate_limit_verification', '20'::jsonb, 'security', 'Verification Rate Limit', 'Maximum verification attempts per minute', 'number', false, false);

-- Email Settings
SELECT set_setting('email.provider', '"resend"'::jsonb, 'email', 'Email Provider', 'Email service provider (resend, sendgrid, etc.)', 'string', false, true);
SELECT set_setting('email.from_address', '"noreply@wagr.app"'::jsonb, 'email', 'From Email Address', 'Default sender email address', 'string', false, true);
SELECT set_setting('email.from_name', '"wagr Platform"'::jsonb, 'email', 'From Name', 'Default sender name', 'string', false, true);
SELECT set_setting('email.enable_wager_settlement', 'true'::jsonb, 'email', 'Wager Settlement Emails', 'Send emails when wagers are settled', 'boolean', false, false);
SELECT set_setting('email.enable_wager_joined', 'true'::jsonb, 'email', 'Wager Joined Emails', 'Send emails when someone joins a wager', 'boolean', false, false);
SELECT set_setting('email.enable_balance_updates', 'true'::jsonb, 'email', 'Balance Update Emails', 'Send emails for balance changes', 'boolean', false, false);
SELECT set_setting('email.enable_welcome_emails', 'true'::jsonb, 'email', 'Welcome Emails', 'Send welcome emails to new users', 'boolean', false, false);
SELECT set_setting('email.enable_quiz_invitations', 'true'::jsonb, 'email', 'Quiz Invitation Emails', 'Send emails for quiz invitations', 'boolean', false, false);
SELECT set_setting('email.enable_quiz_settlement', 'true'::jsonb, 'email', 'Quiz Settlement Emails', 'Send emails when quizzes are settled with results and winnings', 'boolean', false, false);

-- Notification Settings
SELECT set_setting('notifications.enable_push', 'true'::jsonb, 'notifications', 'Enable Push Notifications', 'Enable browser push notifications', 'boolean', true, false);
SELECT set_setting('notifications.enable_email', 'true'::jsonb, 'notifications', 'Enable Email Notifications', 'Enable email notifications', 'boolean', true, false);
SELECT set_setting('notifications.enable_in_app', 'true'::jsonb, 'notifications', 'Enable In-App Notifications', 'Enable in-app notification system', 'boolean', true, false);

-- UI/UX Settings
SELECT set_setting('ui.toast_duration', '5000'::jsonb, 'ui', 'Toast Duration', 'Default toast notification duration in milliseconds', 'number', false, false);
SELECT set_setting('ui.deadline_warning_minutes', '30'::jsonb, 'ui', 'Deadline Warning', 'Show warning when deadline is less than X minutes away', 'number', false, false);
SELECT set_setting('ui.cache_ttl_wagers', '60000'::jsonb, 'ui', 'Wagers Cache TTL', 'Cache TTL for wagers in milliseconds', 'number', false, false);
SELECT set_setting('ui.cache_ttl_user_data', '300000'::jsonb, 'ui', 'User Data Cache TTL', 'Cache TTL for user data in milliseconds', 'number', false, false);
SELECT set_setting('ui.cache_ttl_bank_list', '3600000'::jsonb, 'ui', 'Bank List Cache TTL', 'Cache TTL for bank list in milliseconds', 'number', false, false);

-- Automated Systems Settings
SELECT set_setting('automation.wager_generation_enabled', 'true'::jsonb, 'automation', 'Enable Wager Generation', 'Enable automated wager generation from external APIs', 'boolean', false, true);
SELECT set_setting('automation.wager_settlement_enabled', 'true'::jsonb, 'automation', 'Enable Auto Settlement', 'Automatically settle expired wagers', 'boolean', false, false);
SELECT set_setting('automation.quiz_settlement_enabled', 'true'::jsonb, 'automation', 'Enable Quiz Auto Settlement', 'Automatically settle completed quizzes', 'boolean', false, false);
SELECT set_setting('automation.wager_generation_interval_hours', '6'::jsonb, 'automation', 'Wager Generation Interval', 'Hours between automated wager generation runs', 'number', false, true);
SELECT set_setting('automation.settlement_check_interval_minutes', '60'::jsonb, 'automation', 'Settlement Check Interval', 'Minutes between settlement checks', 'number', false, true);

-- Currency Settings
SELECT set_setting('currency.default_currency', '"NGN"'::jsonb, 'currency', 'Default Currency', 'Default currency code for the platform', 'string', true, false);
SELECT set_setting('currency.supported_currencies', '["NGN", "USD", "EUR", "GBP"]'::jsonb, 'currency', 'Supported Currencies', 'List of supported currency codes', 'array', true, false);

-- ============================================================================
-- STEP 6: Create Trigger for Updated At
-- ============================================================================

CREATE OR REPLACE FUNCTION update_platform_settings_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_platform_settings_timestamp_trigger
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_timestamp();

