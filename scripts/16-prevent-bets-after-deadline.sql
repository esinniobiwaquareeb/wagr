-- Prevent bets after deadline - Database-level validation
-- This adds a check constraint and trigger to prevent entries after deadline

-- Add a function to check if wager is still accepting bets
CREATE OR REPLACE FUNCTION can_accept_bets(wager_id_param uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  wager_record RECORD;
BEGIN
  SELECT * INTO wager_record
  FROM wagers
  WHERE id = wager_id_param;

  -- If wager not found, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if wager is open
  IF wager_record.status != 'OPEN' THEN
    RETURN false;
  END IF;

  -- Check if deadline has passed
  IF wager_record.deadline IS NOT NULL AND wager_record.deadline <= NOW() THEN
    RETURN false;
  END IF;

  RETURN true;
END; $$;

-- Create a trigger function to validate entries before insert
CREATE OR REPLACE FUNCTION validate_wager_entry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Check if wager can still accept bets
  IF NOT can_accept_bets(NEW.wager_id) THEN
    RAISE EXCEPTION 'Cannot place bet: Wager deadline has passed or wager is closed';
  END IF;

  RETURN NEW;
END; $$;

-- Create trigger to validate entries
DROP TRIGGER IF EXISTS check_wager_deadline ON wager_entries;
CREATE TRIGGER check_wager_deadline
  BEFORE INSERT ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_wager_entry();

