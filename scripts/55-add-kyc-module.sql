-- Add KYC metadata to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS kyc_level SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kyc_level_label TEXT DEFAULT 'Level 1 — Email Verified',
  ADD COLUMN IF NOT EXISTS bvn_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nin_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS face_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_last_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_last_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_level ON profiles(kyc_level);

-- Table to capture KYC submissions
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level_requested SMALLINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);

ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users view own kyc submissions" ON kyc_submissions;
CREATE POLICY "users view own kyc submissions" ON kyc_submissions
  FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "users insert kyc submissions" ON kyc_submissions;
CREATE POLICY "users insert kyc submissions" ON kyc_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins update kyc submissions" ON kyc_submissions;
CREATE POLICY "admins update kyc submissions" ON kyc_submissions
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE OR REPLACE FUNCTION update_kyc_submissions_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_kyc_submissions_timestamp_trigger ON kyc_submissions;
CREATE TRIGGER update_kyc_submissions_timestamp_trigger
  BEFORE UPDATE ON kyc_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_kyc_submissions_timestamp();

-- Default KYC configuration
SELECT set_setting('kyc.level1_transfer_enabled', 'false'::jsonb, 'kyc', 'Enable Level 1 Transfers', 'Allow basic users (Level 1) to transfer funds', 'boolean', true, false);
SELECT set_setting('kyc.level2_min_transfer', '2000'::jsonb, 'kyc', 'Level 2 Minimum Transfer', 'Minimum transfer amount for Level 2 users (NGN)', 'number', true, false);
SELECT set_setting('kyc.level2_max_transfer', '50000'::jsonb, 'kyc', 'Level 2 Maximum Transfer', 'Maximum single transfer amount for Level 2 users (NGN)', 'number', true, false);
SELECT set_setting('kyc.level3_min_transfer', '50001'::jsonb, 'kyc', 'Level 3 Minimum Transfer', 'Minimum transfer amount when Level 3 checks are required (NGN)', 'number', true, false);
SELECT set_setting('kyc.level3_max_transfer', '500000'::jsonb, 'kyc', 'Level 3 Maximum Transfer', 'Maximum single/daily transfer amount for fully verified users (NGN)', 'number', true, false);
SELECT set_setting('kyc.daily_transfer_cap', '500000'::jsonb, 'kyc', 'Daily Transfer Cap', 'Maximum cumulative transfer amount per day for any user (NGN)', 'number', true, false);

