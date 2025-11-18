-- Add deadline check to settle_wager function
-- This prevents settling wagers before their deadline has passed
-- Run this script in Supabase SQL Editor

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
      );
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
      );
    END LOOP;
  ELSE
    -- Distribute winnings to winners proportionally
    FOR entry_record IN
      SELECT * FROM wager_entries 
      WHERE wager_id = wager_id_param AND side = wager_record.winning_side
    LOOP
      -- Calculate proportional winnings
      user_winnings := (entry_record.amount / winning_side_entries) * winnings_pool;
      
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
      );
    END LOOP;
  END IF;

  -- Update wager status to SETTLED (actual settlement with winnings distributed)
  UPDATE wagers
  SET status = 'SETTLED'
  WHERE id = wager_id_param;
END;
$$;

-- Grant execute permission to authenticated users (for admin panel)
GRANT EXECUTE ON FUNCTION settle_wager(uuid) TO authenticated;

-- Note: This update adds a deadline check to prevent settling wagers before their deadline
-- Both the frontend and database function now enforce this rule

