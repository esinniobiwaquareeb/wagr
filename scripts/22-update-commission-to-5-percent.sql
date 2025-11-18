-- Update platform commission from 1% to 5%
-- This migration updates the default fee_percentage and existing wagers

-- Update default fee_percentage in wagers table
ALTER TABLE wagers 
ALTER COLUMN fee_percentage SET DEFAULT 0.05;

-- Update existing wagers that have 1% fee to 5%
UPDATE wagers 
SET fee_percentage = 0.05 
WHERE fee_percentage = 0.01;

-- Update any system-generated wagers that might have been created with old default
UPDATE wagers 
SET fee_percentage = 0.05 
WHERE fee_percentage IS NULL OR fee_percentage < 0.05;

