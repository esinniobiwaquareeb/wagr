-- Single Participant Auto-Refund System
-- This ensures transparency by automatically refunding users when they're the only participant

-- Update settle_wager function to handle single participant case
CREATE OR REPLACE FUNCTION settle_wager(wager_id_param uuid)
RETURNS void LANGUAGE plpgsql AS $$
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

  -- Update wager status to RESOLVED
  UPDATE wagers
  SET status = 'RESOLVED'
  WHERE id = wager_id_param;
END; $$;

-- Function to check and auto-refund single participant wagers that have expired
CREATE OR REPLACE FUNCTION check_and_refund_single_participants()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_wager RECORD;
  participant_count INTEGER;
  entry_record RECORD;
  wager_title TEXT;
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
          );
        END LOOP;

        -- Update wager status to RESOLVED
        UPDATE wagers
        SET status = 'RESOLVED', winning_side = NULL
        WHERE id = expired_wager.id;
      END IF;
    END LOOP;
END; $$;

-- Update check_and_settle_expired_wagers to also check for single participants
CREATE OR REPLACE FUNCTION check_and_settle_expired_wagers()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expired_wager RECORD;
BEGIN
  -- First, check and refund single participant wagers
  PERFORM check_and_refund_single_participants();

  -- Then, find wagers that have passed deadline and are still OPEN with winning_side set
  FOR expired_wager IN
    SELECT id, deadline, winning_side
    FROM wagers
    WHERE status = 'OPEN'
      AND deadline IS NOT NULL
      AND deadline <= NOW()
      AND winning_side IS NOT NULL
  LOOP
    -- Settle the wager
    PERFORM settle_wager(expired_wager.id);
  END LOOP;
END; $$;

-- Add description column to transactions if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'description'
  ) THEN
    ALTER TABLE transactions ADD COLUMN description TEXT;
  END IF;
END $$;

