-- Migration: Add variable wager amounts support
-- This adds min_amount and max_amount columns to wagers table
-- and creates a setting to enable/disable the feature

-- Add min_amount and max_amount columns to wagers table
ALTER TABLE wagers 
ADD COLUMN IF NOT EXISTS min_amount NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS max_amount NUMERIC(15, 2);

-- Migrate existing data: set min_amount = amount, max_amount = NULL (unlimited)
UPDATE wagers 
SET min_amount = amount, max_amount = NULL 
WHERE min_amount IS NULL;

-- Make min_amount NOT NULL with default (for new wagers)
ALTER TABLE wagers 
ALTER COLUMN min_amount SET DEFAULT 100,
ALTER COLUMN min_amount SET NOT NULL;

-- Create index for min_amount queries
CREATE INDEX IF NOT EXISTS idx_wagers_min_amount ON wagers(min_amount);

-- Add setting to enable/disable variable amounts feature
INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public, requires_restart, created_at, updated_at)
VALUES (
  'wagers.variable_amounts_enabled',
  'false'::jsonb,
  'wagers',
  'Variable Wager Amounts',
  'Allow users to join wagers with any amount between min and max (instead of fixed amount). When disabled, users must use the exact min_amount.',
  'boolean',
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Add setting for default max amount multiplier (if max_amount is NULL, use min_amount * multiplier)
INSERT INTO platform_settings (key, value, category, label, description, data_type, is_public, requires_restart, created_at, updated_at)
VALUES (
  'wagers.default_max_amount_multiplier',
  '10'::jsonb,
  'wagers',
  'Default Max Amount Multiplier',
  'When max_amount is not set, calculate it as min_amount * this multiplier. Set to 0 for unlimited.',
  'number',
  false,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
