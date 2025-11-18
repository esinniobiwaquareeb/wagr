-- Add email notification triggers
-- This extends the notification system to also send emails

-- Function to send email notification when wager is resolved
CREATE OR REPLACE FUNCTION send_wager_resolved_email()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  entry_record RECORD;
  user_email TEXT;
  user_name TEXT;
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

    -- If only 1 participant, send refund email
    IF participant_count = 1 THEN
      FOR entry_record IN
        SELECT DISTINCT we.user_id, p.username, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        LEFT JOIN profiles p ON p.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Call email API endpoint
        PERFORM net.http_post(
          url := current_setting('app.settings.email_api_url', true) || '/api/notifications/send-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.notification_api_secret', true)
          ),
          body := jsonb_build_object(
            'user_id', entry_record.user_id,
            'type', 'wager_resolved',
            'metadata', jsonb_build_object(
              'wager_id', NEW.id,
              'won', false,
              'refunded', true,
              'amount', 0
            )
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_pool
      FROM wager_entries
      WHERE wager_id = NEW.id;

      platform_fee := total_pool * NEW.fee_percentage;
      winnings_pool := total_pool - platform_fee;

      SELECT COALESCE(SUM(amount), 0) INTO winning_side_entries
      FROM wager_entries
      WHERE wager_id = NEW.id AND side = NEW.winning_side;

      -- Send emails to all participants
      FOR entry_record IN
        SELECT DISTINCT we.user_id, p.username, u.email,
               CASE WHEN EXISTS (
                 SELECT 1 FROM wager_entries 
                 WHERE wager_id = NEW.id 
                 AND user_id = we.user_id 
                 AND side = NEW.winning_side
               ) THEN true ELSE false END as won
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        LEFT JOIN profiles p ON p.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Calculate winnings if user won
        user_winnings := 0;
        IF entry_record.won THEN
          SELECT COALESCE(SUM(amount), 0) INTO user_winnings
          FROM wager_entries
          WHERE wager_id = NEW.id 
          AND user_id = entry_record.user_id 
          AND side = NEW.winning_side;

          IF winning_side_entries > 0 THEN
            user_winnings := (user_winnings / winning_side_entries) * winnings_pool;
          END IF;
        END IF;

        -- Call email API endpoint
        -- Note: Using pg_net or similar extension for HTTP calls
        -- If not available, emails will be sent via the notification API endpoint
        PERFORM net.http_post(
          url := current_setting('app.settings.email_api_url', true) || '/api/notifications/send-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.notification_api_secret', true)
          ),
          body := jsonb_build_object(
            'user_id', entry_record.user_id,
            'type', 'wager_resolved',
            'metadata', jsonb_build_object(
              'wager_id', NEW.id,
              'won', entry_record.won,
              'amount', user_winnings
            )
          )
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Alternative: Use a simpler approach with a notification queue
-- Create a table to queue email notifications
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  email_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);

-- Function to queue email notification
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_user_id uuid,
  p_type text,
  p_email_data jsonb
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO email_queue (user_id, type, email_data)
  VALUES (p_user_id, p_type, p_email_data);
END;
$$;

-- Update notification trigger to also queue emails
CREATE OR REPLACE FUNCTION notify_wager_resolved_with_email()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  entry_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
  user_email TEXT;
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
        SELECT DISTINCT we.user_id, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        WHERE we.wager_id = NEW.id
      LOOP
        -- Create in-app notification
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

        -- Queue email notification
        PERFORM queue_email_notification(
          entry_record.user_id,
          'wager_resolved',
          jsonb_build_object(
            'wager_id', NEW.id,
            'wager_title', NEW.title,
            'won', false,
            'refunded', true,
            'amount', 0
          )
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- Continue with normal resolution if winning_side is set
    IF NEW.winning_side IS NOT NULL THEN
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
        SELECT DISTINCT we.user_id, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        WHERE we.wager_id = NEW.id
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

          -- Create in-app notification
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

          -- Queue email notification
          PERFORM queue_email_notification(
            entry_record.user_id,
            'wager_resolved',
            jsonb_build_object(
              'wager_id', NEW.id,
              'wager_title', NEW.title,
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

          -- Queue email notification
          PERFORM queue_email_notification(
            entry_record.user_id,
            'wager_resolved',
            jsonb_build_object(
              'wager_id', NEW.id,
              'wager_title', NEW.title,
              'won', false,
              'amount', 0
            )
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS trigger_notify_wager_resolved ON wagers;
CREATE TRIGGER trigger_notify_wager_resolved
  AFTER UPDATE ON wagers
  FOR EACH ROW
  WHEN (NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED')
  EXECUTE FUNCTION notify_wager_resolved_with_email();

