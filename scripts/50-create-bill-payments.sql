-- Create bill_payments table to track airtime/data purchases
CREATE TABLE IF NOT EXISTS bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  provider text NOT NULL,
  amount numeric NOT NULL,
  phone_number text,
  network_code text,
  network_name text,
  bonus_type text,
  request_id text NOT NULL,
  order_id text,
  reference text,
  status text NOT NULL DEFAULT 'pending',
  status_code text,
  remark text,
  metadata jsonb DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  refund_transaction_id uuid REFERENCES transactions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_request_id ON bill_payments(request_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_order_id ON bill_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_status ON bill_payments(status);

-- Enable RLS and policies
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view their bill payments" ON bill_payments;

CREATE POLICY "users can view their bill payments"
  ON bill_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger to manage updated_at
CREATE OR REPLACE FUNCTION update_bill_payments_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_bill_payments_timestamp_trigger ON bill_payments;
CREATE TRIGGER update_bill_payments_timestamp_trigger
  BEFORE UPDATE ON bill_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bill_payments_timestamp();

-- Settings for bills module
SELECT set_setting('features.bills_enabled', 'true'::jsonb, 'features', 'Enable Bills', 'Allow bills and airtime purchases', 'boolean', true, false);
SELECT set_setting('bills.airtime_enabled', 'true'::jsonb, 'bills', 'Enable Airtime Purchases', 'Allow airtime purchases via Nellobyte', 'boolean', true, false);
SELECT set_setting('bills.airtime_min_amount', '50'::jsonb, 'bills', 'Minimum Airtime Amount', 'Minimum allowed airtime purchase (NGN)', 'number', true, false);
SELECT set_setting('bills.airtime_max_amount', '200000'::jsonb, 'bills', 'Maximum Airtime Amount', 'Maximum allowed airtime purchase (NGN)', 'number', true, false);
SELECT set_setting('bills.nellobyte_user_id', '""'::jsonb, 'bills', 'Nellobyte User ID', 'Nellobyte Systems UserID credential', 'string', false, true);
SELECT set_setting('bills.nellobyte_api_key', '""'::jsonb, 'bills', 'Nellobyte API Key', 'Nellobyte Systems API key credential', 'string', false, true);
SELECT set_setting('bills.callback_url', '""'::jsonb, 'bills', 'Bills Callback URL', 'Callback endpoint for Nellobyte to notify transaction status', 'string', false, false);
SELECT set_setting('bills.allowed_network_codes', '["01","02","03","04"]'::jsonb, 'bills', 'Allowed Airtime Networks', 'List of enabled mobile network codes for airtime', 'array', true, false);
SELECT set_setting('bills.default_bonus_type', 'null'::jsonb, 'bills', 'Default Bonus Type', 'Optional bonus type to append for Airtime purchases', 'string', false, false);

