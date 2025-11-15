-- Add notification triggers for wager events
-- This creates database triggers to automatically send notifications

-- Function to create notification when wager is resolved
CREATE OR REPLACE FUNCTION notify_wager_resolved()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  entry_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
BEGIN
  -- Only trigger when status changes to RESOLVED
  IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
    -- Count participants
    SELECT COUNT(DISTINCT user_id) INTO participant_count
    FROM wager_entries
    WHERE wager_id = NEW.id;

    -- If only 1 participant, notify about refund
    IF participant_count = 1 THEN
      FOR entry_record IN
        SELECT DISTINCT user_id FROM wager_entries WHERE wager_id = NEW.id
      LOOP
        INSERT INTO notifications (user_id, type, title, message, link, metadata)
        VALUES (
          entry_record.user_id,
          'wager_resolved',
          'Wager Refunded',
          'Your wager "' || NEW.title || '" has been refunded. You were the only participant.',
          '/wager/' || NEW.id,
          jsonb_build_object(
            'wager_id', NEW.id,
            'refunded', true,
            'reason', 'single_participant'
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
      -- Calculate winnings for each winner
      SELECT COALESCE(SUM(amount), 0) INTO total_pool
      FROM wager_entries
      WHERE wager_id = NEW.id;

      platform_fee := total_pool * NEW.fee_percentage;
      winnings_pool := total_pool - platform_fee;

      SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
      FROM wager_entries
      WHERE wager_id = NEW.id AND side = NEW.winning_side;

      -- Notify all participants
      FOR entry_record IN
        SELECT DISTINCT user_id FROM wager_entries WHERE wager_id = NEW.id
      LOOP
        -- Check if user won
        IF EXISTS (
          SELECT 1 FROM wager_entries 
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side
        ) THEN
          -- User won - calculate their winnings
          SELECT COALESCE(SUM(amount), 0) INTO user_winnings
          FROM wager_entries
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side;

          IF winning_side_entries > 0 THEN
            user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
          END IF;

          -- Create notification for winner
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'You won a wager! 🎉',
            'You won ' || user_winnings || ' on "' || NEW.title || '"',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', true,
              'amount', user_winnings
            )
          );
        ELSE
          -- User lost
          INSERT INTO notifications (user_id, type, title, message, link, metadata)
          VALUES (
            entry_record.user_id,
            'wager_resolved',
            'Wager resolved',
            'The wager "' || NEW.title || '" has been resolved',
            '/wager/' || NEW.id,
            jsonb_build_object(
              'wager_id', NEW.id,
              'won', false
            )
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for wager resolution
DROP TRIGGER IF EXISTS trigger_notify_wager_resolved ON wagers;
CREATE TRIGGER trigger_notify_wager_resolved
  AFTER UPDATE ON wagers
  FOR EACH ROW
  WHEN (NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED')
  EXECUTE FUNCTION notify_wager_resolved();

-- Function to notify when someone joins a wager
CREATE OR REPLACE FUNCTION notify_wager_joined()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  wager_record RECORD;
  participant_count INTEGER;
BEGIN
  -- Get wager details
  SELECT * INTO wager_record FROM wagers WHERE id = NEW.wager_id;
  
  -- Count participants
  SELECT COUNT(DISTINCT user_id) INTO participant_count
  FROM wager_entries
  WHERE wager_id = NEW.wager_id;

  -- Notify creator if they exist and it's not their own entry
  IF wager_record.creator_id IS NOT NULL 
     AND wager_record.creator_id != NEW.user_id 
     AND participant_count > 1 THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      wager_record.creator_id,
      'wager_joined',
      'Someone joined your wager',
      participant_count || ' ' || 
      CASE WHEN participant_count = 1 THEN 'person has' ELSE 'people have' END ||
      ' joined "' || wager_record.title || '"',
      '/wager/' || NEW.wager_id,
      jsonb_build_object(
        'wager_id', NEW.wager_id,
        'participant_count', participant_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for wager joins
DROP TRIGGER IF EXISTS trigger_notify_wager_joined ON wager_entries;
CREATE TRIGGER trigger_notify_wager_joined
  AFTER INSERT ON wager_entries
  FOR EACH ROW
  EXECUTE FUNCTION notify_wager_joined();

