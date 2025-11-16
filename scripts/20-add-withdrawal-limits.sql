-- Withdrawal Limits and Management

-- Add withdrawal limits to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_daily_limit NUMERIC DEFAULT 500000; -- ₦500,000 default
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_monthly_limit NUMERIC DEFAULT 5000000; -- ₦5,000,000 default
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_daily_used NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_monthly_used NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_limit_reset_date DATE DEFAULT CURRENT_DATE;

-- Add withdrawal status tracking
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Function to reset daily withdrawal limits
CREATE OR REPLACE FUNCTION reset_daily_withdrawal_limits()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET 
    withdrawal_daily_used = 0,
    withdrawal_limit_reset_date = CURRENT_DATE
  WHERE withdrawal_limit_reset_date < CURRENT_DATE;
END;
$$;

-- Function to reset monthly withdrawal limits
CREATE OR REPLACE FUNCTION reset_monthly_withdrawal_limits()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET withdrawal_monthly_used = 0
  WHERE DATE_TRUNC('month', withdrawal_limit_reset_date) < DATE_TRUNC('month', CURRENT_DATE);
END;
$$;

-- Function to check withdrawal limits
CREATE OR REPLACE FUNCTION check_withdrawal_limits(
  user_id_param UUID,
  amount_param NUMERIC
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  user_profile RECORD;
  daily_remaining NUMERIC;
  monthly_remaining NUMERIC;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = user_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- Reset daily limit if needed
  IF user_profile.withdrawal_limit_reset_date < CURRENT_DATE THEN
    PERFORM reset_daily_withdrawal_limits();
    -- Re-fetch profile
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = user_id_param;
  END IF;

  -- Calculate remaining limits
  daily_remaining := COALESCE(user_profile.withdrawal_daily_limit, 500000) - COALESCE(user_profile.withdrawal_daily_used, 0);
  monthly_remaining := COALESCE(user_profile.withdrawal_monthly_limit, 5000000) - COALESCE(user_profile.withdrawal_monthly_used, 0);

  -- Check limits
  IF amount_param > daily_remaining THEN
    RETURN QUERY SELECT false, format('Daily withdrawal limit exceeded. Remaining: ₦%s', daily_remaining)::TEXT;
    RETURN;
  END IF;

  IF amount_param > monthly_remaining THEN
    RETURN QUERY SELECT false, format('Monthly withdrawal limit exceeded. Remaining: ₦%s', monthly_remaining)::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$;

