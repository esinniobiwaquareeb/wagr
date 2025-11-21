-- Add unique constraint on transactions reference to prevent duplicate processing
-- This ensures that the same payment reference can only be processed once

-- First, remove any duplicate transactions (keep the oldest one)
DELETE FROM transactions t1
WHERE EXISTS (
  SELECT 1 FROM transactions t2
  WHERE t2.reference = t1.reference
    AND t2.type = t1.type
    AND t2.id < t1.id
);

-- Add unique constraint on (reference, type) combination
-- This prevents duplicate processing of the same payment
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_type_unique 
ON transactions(reference, type) 
WHERE reference IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

