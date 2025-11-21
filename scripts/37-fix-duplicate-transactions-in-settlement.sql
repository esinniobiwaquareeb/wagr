-- Fix duplicate transaction errors in settlement functions
-- This adds idempotency checks to prevent duplicate transaction inserts
-- Run this script in Supabase SQL Editor

-- First, update the unique constraint to include user_id for wager transactions
-- This allows multiple users to have transactions for the same wager reference
-- Drop the old constraint if it exists
DROP INDEX IF EXISTS transactions_reference_type_unique;

-- Create a new unique constraint that includes user_id for better uniqueness
-- This prevents the same user from having duplicate transactions for the same reference+type
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_type_user_unique 
ON transactions(reference, type, user_id) 
WHERE reference IS NOT NULL;

-- Update settle_wager function to check for existing transactions before inserting
CREATE OR REPLACE FUNCTION settle_wager(wager_id_param uuid)
RETURNS void LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wager_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  losing_side_entries NUMERIC;
  entry_record RECORD;
  user_winnings NUMERIC;
  participant_count INTEGER;
  wager_title TEXT;
  transaction_exists BOOLEAN;
BEGIN
  -- Get wager details
  SELECT * INTO wager_record
  FROM wagers
  WHERE id = wager_id_param AND status = 'OPEN';

  -- Skip if wager not found or already resolved
  IF NOT FOUND OR wager_record.winning_side IS NULL THEN
    RETURN;
  END IF;

  -- Check if deadline has passed (if deadline exists)
  IF wager_record.deadline IS NOT NULL AND wager_record.deadline > NOW() THEN
    -- Raise an error if trying to settle before deadline
    RAISE EXCEPTION 'Cannot settle wager before deadline. Deadline: %, Current time: %', 
      wager_record.deadline, NOW();
  END IF;

  -- Get wager title for transaction description
  wager_title := wager_record.title;

  -- Count total participants
  SELECT COUNT(DISTINCT user_id) INTO participant_count
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- Calculate total pool from all entries
  SELECT COALESCE(SUM(amount), 0) INTO total_pool
  FROM wager_entries
  WHERE wager_id = wager_id_param;

  -- If only 1 participant, refund them automatically
  IF participant_count = 1 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Check if transaction already exists
      SELECT EXISTS(
        SELECT 1 FROM transactions 
        WHERE reference = wager_id_param::text 
          AND type = 'wager_refund'
          AND user_id = entry_record.user_id
      ) INTO transaction_exists;

      -- Only process if transaction doesn't exist
      IF NOT transaction_exists THEN
        -- Refund full entry amount
        PERFORM increment_balance(entry_record.user_id, entry_record.amount);
        
        -- Record transaction with detailed description
        INSERT INTO transactions (user_id, type, amount, reference, description)
        VALUES (
          entry_record.user_id,
          'wager_refund',
          entry_record.amount,
          wager_id_param::text,
          'Refund: "' || wager_title || '" - Only participant, wager cancelled'
        )
        ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
      END IF;
    END LOOP;

    -- Update wager status to RESOLVED
    UPDATE wagers
    SET status = 'RESOLVED', winning_side = NULL
    WHERE id = wager_id_param;

    RETURN;
  END IF;

  -- Calculate platform fee
  platform_fee := total_pool * wager_record.fee_percentage;
  winnings_pool := total_pool - platform_fee;

  -- Count entries on each side
  SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side = wager_record.winning_side;

  SELECT COALESCE(SUM(amount), 0) INTO losing_side_entries
  FROM wager_entries
  WHERE wager_id = wager_id_param AND side != wager_record.winning_side;

  -- If no winners, refund everyone
  IF winning_side_entries = 0 THEN
    FOR entry_record IN
      SELECT * FROM wager_entries WHERE wager_id = wager_id_param
    LOOP
      -- Check if transaction already exists
      SELECT EXISTS(
        SELECT 1 FROM transactions 
        WHERE reference = wager_id_param::text 
          AND type = 'wager_refund'
          AND user_id = entry_record.user_id
      ) INTO transaction_exists;

      -- Only process if transaction doesn't exist
      IF NOT transaction_exists THEN
        -- Refund entry amount
        PERFORM increment_balance(entry_record.user_id, entry_record.amount);
        
        -- Record transaction with detailed description
        INSERT INTO transactions (user_id, type, amount, reference, description)
        VALUES (
          entry_record.user_id,
          'wager_refund',
          entry_record.amount,
          wager_id_param::text,
          'Refund: "' || wager_title || '" - No winners declared'
        )
        ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
      END IF;
    END LOOP;
  ELSE
    -- Distribute winnings to winners proportionally
    FOR entry_record IN
      SELECT * FROM wager_entries 
      WHERE wager_id = wager_id_param AND side = wager_record.winning_side
    LOOP
      -- Calculate proportional winnings
      user_winnings := (entry_record.amount / winning_side_entries) * winnings_pool;
      
      -- Check if transaction already exists
      SELECT EXISTS(
        SELECT 1 FROM transactions 
        WHERE reference = wager_id_param::text 
          AND type = 'wager_win'
          AND user_id = entry_record.user_id
      ) INTO transaction_exists;

      -- Only process if transaction doesn't exist
      IF NOT transaction_exists THEN
        -- Add winnings to user balance
        PERFORM increment_balance(entry_record.user_id, user_winnings);
        
        -- Record transaction with detailed description
        INSERT INTO transactions (user_id, type, amount, reference, description)
        VALUES (
          entry_record.user_id,
          'wager_win',
          user_winnings,
          wager_id_param::text,
          'Wager Win: "' || wager_title || '" - Won ' || 
          CASE 
            WHEN entry_record.side = 'a' THEN wager_record.side_a
            ELSE wager_record.side_b
          END ||
          ' (Entry: ' || entry_record.amount || ', Winnings: ' || user_winnings || ')'
        )
        ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Update wager status to SETTLED (actual settlement with winnings distributed)
  UPDATE wagers
  SET status = 'SETTLED'
  WHERE id = wager_id_param;
END;
$$;

-- Update check_and_refund_single_participants function to check for existing transactions
CREATE OR REPLACE FUNCTION check_and_refund_single_participants()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_wager RECORD;
  participant_count INTEGER;
  entry_record RECORD;
  wager_title TEXT;
  transaction_exists BOOLEAN;
BEGIN
  -- Find wagers that have passed deadline, are still OPEN, and have only 1 participant
  FOR expired_wager IN
    SELECT w.id, w.title, w.deadline
    FROM wagers w
    WHERE w.status = 'OPEN'
      AND w.deadline IS NOT NULL
      AND w.deadline <= NOW()
    LOOP
      -- Count participants for this wager
      SELECT COUNT(DISTINCT user_id) INTO participant_count
      FROM wager_entries
      WHERE wager_id = expired_wager.id;

      -- If only 1 participant, refund them
      IF participant_count = 1 THEN
        wager_title := expired_wager.title;

        FOR entry_record IN
          SELECT * FROM wager_entries WHERE wager_id = expired_wager.id
        LOOP
          -- Check if transaction already exists
          SELECT EXISTS(
            SELECT 1 FROM transactions 
            WHERE reference = expired_wager.id::text 
              AND type = 'wager_refund'
              AND user_id = entry_record.user_id
          ) INTO transaction_exists;

          -- Only process if transaction doesn't exist
          IF NOT transaction_exists THEN
            -- Refund full entry amount
            PERFORM increment_balance(entry_record.user_id, entry_record.amount);
            
            -- Record transaction with detailed description
            INSERT INTO transactions (user_id, type, amount, reference, description)
            VALUES (
              entry_record.user_id,
              'wager_refund',
              entry_record.amount,
              expired_wager.id::text,
              'Auto-Refund: "' || wager_title || '" - Only participant, deadline passed'
            )
            ON CONFLICT (reference, type, user_id) WHERE reference IS NOT NULL DO NOTHING;
          END IF;
        END LOOP;

        -- Update wager status to RESOLVED
        UPDATE wagers
        SET status = 'RESOLVED', winning_side = NULL
        WHERE id = expired_wager.id;
      END IF;
    END LOOP;
END; $$;

-- Grant execute permission to authenticated users (for admin panel)
GRANT EXECUTE ON FUNCTION settle_wager(uuid) TO authenticated;

-- Note: This update adds idempotency checks to prevent duplicate transaction inserts
-- The functions now check if a transaction already exists before inserting
-- ON CONFLICT DO NOTHING provides an additional safety net

