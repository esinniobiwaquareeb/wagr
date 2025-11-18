-- Fix notification trigger functions to have proper permissions
-- This allows them to access auth.users table for email addresses
-- Run this script in Supabase SQL Editor to fix the permission errors

-- Fix the main notification function (if it exists and accesses auth.users)
-- Note: This function may have been replaced by notify_wager_resolved_with_email
-- but we'll update it if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'notify_wager_resolved'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION notify_wager_resolved()
      RETURNS TRIGGER LANGUAGE plpgsql 
      SECURITY DEFINER
      SET search_path = public, auth
      AS $func$
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
        IF NEW.status = ''RESOLVED'' AND OLD.status != ''RESOLVED'' THEN
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
                ''wager_resolved'',
                ''Wager Refunded'',
                ''Your wager "'' || NEW.title || ''" has been refunded. You were the only participant.'',
                ''/wager/'' || NEW.id,
                jsonb_build_object(
                  ''wager_id'', NEW.id,
                  ''refunded'', true,
                  ''reason'', ''single_participant''
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
                  ''wager_resolved'',
                  ''You won a wager! 🎉'',
                  ''You won '' || user_winnings || '' on "'' || NEW.title || ''"'',
                  ''/wager/'' || NEW.id,
                  jsonb_build_object(
                    ''wager_id'', NEW.id,
                    ''won'', true,
                    ''amount'', user_winnings
                  )
                );
              ELSE
                -- User lost
                INSERT INTO notifications (user_id, type, title, message, link, metadata)
                VALUES (
                  entry_record.user_id,
                  ''wager_resolved'',
                  ''Oops, you lost this bet 😔'',
                  ''Unfortunately, you lost the wager "'' || NEW.title || ''". Better luck next time!'',
                  ''/wager/'' || NEW.id,
                  jsonb_build_object(
                    ''wager_id'', NEW.id,
                    ''won'', false
                  )
                );
              END IF;
            END LOOP;
          END IF;
        END IF;

        RETURN NEW;
      END;
      $func$;
    ';
  END IF;
END $$;

-- Fix send_wager_resolved_email function (already updated in 15-add-email-notifications.sql)
-- This ensures it has SECURITY DEFINER if the script hasn't been run yet
CREATE OR REPLACE FUNCTION send_wager_resolved_email()
RETURNS TRIGGER LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
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
  -- Only trigger when status changes to RESOLVED or SETTLED
  IF (NEW.status = 'RESOLVED' OR NEW.status = 'SETTLED') AND (OLD.status != 'RESOLVED' AND OLD.status != 'SETTLED') THEN
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

-- Fix notify_wager_resolved_with_email function (the one currently being used)
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
  user_email TEXT;
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

-- Note: After running this script, the settlement endpoint should work without permission errors
-- The SECURITY DEFINER clause allows these functions to access auth.users table
-- The SET search_path ensures they can find both public and auth schemas

