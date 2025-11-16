-- Function to increment withdrawal usage atomically
CREATE OR REPLACE FUNCTION increment_withdrawal_usage(
  user_id_param UUID,
  amount_param NUMERIC
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET 
    withdrawal_daily_used = COALESCE(withdrawal_daily_used, 0) + amount_param,
    withdrawal_monthly_used = COALESCE(withdrawal_monthly_used, 0) + amount_param
  WHERE id = user_id_param;
END;
$$;

