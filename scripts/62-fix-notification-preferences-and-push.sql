-- Fix notification system to respect user preferences and ensure push notifications work
-- This script updates notification triggers to check user preferences before creating notifications

-- Helper function to check if user wants to receive notifications
CREATE OR REPLACE FUNCTION should_send_notification(
  p_user_id uuid,
  p_notification_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preferences record;
BEGIN
  -- Get user preferences
  SELECT 
    notification_enabled,
    notification_types,
    push_notifications_enabled
  INTO v_preferences
  FROM user_preferences
  WHERE user_id = p_user_id
  LIMIT 1;

  -- If no preferences exist, default to enabled (fail open)
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- If notifications are explicitly disabled, don't send
  IF v_preferences.notification_enabled = false THEN
    RETURN false;
  END IF;

  -- If notification types are specified, check if this type is enabled
  IF v_preferences.notification_types IS NOT NULL 
     AND jsonb_typeof(v_preferences.notification_types) = 'array'
     AND jsonb_array_length(v_preferences.notification_types) > 0 THEN
    -- Check if the notification type is in the array
    IF NOT EXISTS (
      SELECT 1 
      FROM jsonb_array_elements_text(v_preferences.notification_types) AS elem
      WHERE elem = p_notification_type
    ) THEN
      -- User has specific notification types enabled, and this type is not in the list
      RETURN false;
    END IF;
  END IF;

  -- All checks passed, send notification
  RETURN true;
END;
$$;

-- Update notify_wager_joined to check preferences
CREATE OR REPLACE FUNCTION notify_wager_joined()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
     AND participant_count > 1 
     AND should_send_notification(wager_record.creator_id, 'wager_joined') THEN
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

-- Update notify_wager_resolved_with_email to check preferences
CREATE OR REPLACE FUNCTION notify_wager_resolved_with_email()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  entry_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  winning_side_entries NUMERIC;
  user_winnings NUMERIC;
  participant_count INTEGER;
BEGIN
  -- Only trigger when status changes to RESOLVED or SETTLED
  IF (NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED') THEN
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
          AND should_send_notification(we.user_id, 'wager_resolved')
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

      -- Notify all participants (only those who want notifications)
      FOR entry_record IN
        SELECT DISTINCT we.user_id, u.email
        FROM wager_entries we
        JOIN auth.users u ON u.id = we.user_id
        WHERE we.wager_id = NEW.id
          AND should_send_notification(we.user_id, 'wager_resolved')
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
            'Oops, you lost this bet 😔',
            'Unfortunately, you lost the wager "' || NEW.title || '". Better luck next time!',
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

-- Note: The trigger on notifications table (from 61-add-push-notification-trigger.sql) will
-- automatically send push notifications when notifications are inserted, checking user
-- preferences for push_notifications_enabled.

