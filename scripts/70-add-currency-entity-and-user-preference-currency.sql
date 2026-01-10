-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on code
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);

-- Seed currencies
INSERT INTO currencies (code, name, symbol, is_active) VALUES
  ('NGN', 'Nigerian Naira', '₦', true),
  ('USD', 'US Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('GBP', 'British Pound', '£', true)
ON CONFLICT (code) DO NOTHING;

-- Add currency_id to user_preferences
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS currency_id UUID REFERENCES currencies(id) ON DELETE SET NULL;

-- Create index on currency_id
CREATE INDEX IF NOT EXISTS idx_user_preferences_currency_id ON user_preferences(currency_id);

-- Set default currency (NGN) for existing users
UPDATE user_preferences
SET currency_id = (SELECT id FROM currencies WHERE code = 'NGN' LIMIT 1)
WHERE currency_id IS NULL;

-- Remove currency column from wagers (or keep it for backward compatibility)
-- We'll keep it for now but it will use the creator's currency preference
