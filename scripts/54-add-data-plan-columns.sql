-- Add data-specific columns to bill_payments
ALTER TABLE bill_payments
  ADD COLUMN IF NOT EXISTS data_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS data_plan_label TEXT;

-- Settings for data bundles
SELECT set_setting('bills.data_enabled', 'true'::jsonb, 'bills', 'Enable Data Purchases', 'Allow data bundle purchases via providers', 'boolean', true, false);
SELECT set_setting('bills.data_min_amount', '100'::jsonb, 'bills', 'Minimum Data Amount', 'Minimum allowed data purchase amount (NGN)', 'number', true, false);
SELECT set_setting('bills.data_max_amount', '500000'::jsonb, 'bills', 'Maximum Data Amount', 'Maximum allowed data purchase amount (NGN)', 'number', true, false);

