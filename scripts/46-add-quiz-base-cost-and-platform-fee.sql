-- Add base_cost and platform_fee columns to quizzes table
-- This separates the base cost (what participants pay) from platform fee (what creator pays extra)

ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS base_cost NUMERIC,
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC;

-- Update existing quizzes to calculate base_cost and platform_fee from total_cost
-- total_cost = base_cost + platform_fee
-- platform_fee = base_cost * platform_fee_percentage
-- So: total_cost = base_cost * (1 + platform_fee_percentage)
-- Therefore: base_cost = total_cost / (1 + platform_fee_percentage)
UPDATE quizzes
SET 
  base_cost = total_cost / (1 + COALESCE(platform_fee_percentage, 0.10)),
  platform_fee = (total_cost / (1 + COALESCE(platform_fee_percentage, 0.10))) * COALESCE(platform_fee_percentage, 0.10)
WHERE base_cost IS NULL OR platform_fee IS NULL;

-- Make base_cost and platform_fee NOT NULL for new records
ALTER TABLE quizzes
ALTER COLUMN base_cost SET NOT NULL,
ALTER COLUMN platform_fee SET NOT NULL;

-- Add default values (will be calculated on insert)
ALTER TABLE quizzes
ALTER COLUMN base_cost SET DEFAULT 0,
ALTER COLUMN platform_fee SET DEFAULT 0;

